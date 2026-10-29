const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { createRequire } = Module;
const { File } = require('node:buffer');
const { EventEmitter } = require('node:events');

const frontend = path.resolve(__dirname, '..');
const frontendRequire = createRequire(path.join(frontend, 'package.json'));
const ts = frontendRequire('typescript');
const filename = path.join(frontend, 'src/services/n8nChat.ts');
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled.require = name => name === './authSession'
  ? { getAccessToken: () => 'synthetic-test-token', refreshAuthSession: async () => true }
  : name === './chatPayload' ? { parseWebhookBody: JSON.parse } : frontendRequire(name);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { N8nChatService } = compiled.exports;

global.window = { setTimeout, clearTimeout };
const calls = [];
global.fetch = async (url, options) => {
  calls.push({ url, ...options });
  return new Response(JSON.stringify({ output: 'Test reply' }), {
    status: calls.length % 2 === 1 ? 401 : 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

(async () => {
  const general = new N8nChatService('https://example.invalid/chat', '', 'test-general-session');
  general.setSocketId('test-connection');
  await general.sendMessage('Hello');
  assert.equal(calls.length, 2, 'Expected one auth retry');
  const text = calls.map(c => JSON.parse(c.body));
  const id = text[0].clientMessageId;
  assert.ok(id);
  for (const request of text) {
    assert.equal(request.sessionId, 'test-general-session');
    assert.equal(request.socketId, 'test-connection');
    assert.equal(request.clientMessageId, id);
    assert.equal(request.requestId, id);
    assert.equal(request.metadata.requestId, id);
    assert.equal(request.metadata.clientMessageId, id);
  }

  calls.length = 0;
  const document = new N8nChatService('https://example.invalid/chat', '', 'test-document-session', undefined, undefined, 1);
  document.setSocketId('test-connection');
  await document.uploadFiles([new File(['Project Falcon 42'], 'trace.txt')], {
    chatInput: 'What is the project name?', clientMessageId: 'document-turn-1', requestId: 'must-not-duplicate',
  });
  assert.equal(calls.length, 2);
  for (const request of calls) {
    const data = request.body;
    assert.ok(data instanceof FormData);
    assert.equal(data.get('sessionId'), 'test-document-session');
    assert.equal(data.get('socketId'), 'test-connection');
    assert.equal(data.get('clientMessageId'), 'document-turn-1');
    assert.deepEqual(data.getAll('requestId'), ['document-turn-1']);
    const metadata = JSON.parse(data.get('metadata'));
    assert.equal(metadata.clientMessageId, 'document-turn-1');
    assert.equal(metadata.requestId, 'document-turn-1');
    assert.equal(metadata.serviceId, 1);
    assert.equal(request.headers.get('Content-Type'), null, 'Browser must supply the multipart boundary');
    assert.equal(data.getAll('files').length, 1);
  }
  const buttonMetadata = document.getUploadMetadata({ clientMessageId: 'button-turn', requestId: 'button-turn' });
  assert.equal(buttonMetadata.requestId, buttonMetadata.clientMessageId);
  // Existing backend code already accepts requestId. Check the captured classifier
  // and progress expression without invoking OCR, a model, or a live workflow.
  const workflow = JSON.parse(fs.readFileSync(path.join(frontend,
    'scripts/test-support/document-trace.json'), 'utf8'));
  const classify = workflow.nodes.find(n => n.name === 'File - Inspect and Classify').parameters.jsCode;
  const classified = new Function('$input', classify)({ first: () => ({
    json: { sessionId:'test-document-session', clientMessageId:'document-turn-1', requestId:'document-turn-1', metadata:buttonMetadata },
    binary: { file: { fileName:'trace.pdf', fileExtension:'pdf', mimeType:'application/pdf' } },
  }) });
  assert.equal(classified[0].json.requestId, 'document-turn-1');
  const statusExpression = workflow.nodes.find(n => n.name === 'WebSocket Status - Reading Document').parameters.jsonBody
    .replace(/^=\{\{/, '').replace(/\}\}\s*$/, '');
  const status = new Function('$json', 'return ('+statusExpression+');')(classified[0].json);
  assert.equal(status.requestId, 'document-turn-1');
  assert.equal(status.sessionDetails.sessionId, 'test-document-session');

  for (const upload of [false, true]) {
    calls.length = 0;
    let resolveConnection;
    const ready = new Promise(resolve => { resolveConnection = resolve; });
    const service = new N8nChatService('https://example.invalid/chat', '', 'waiting-session');
    service.setSocketConnector(() => ready);
    const pending = upload ? service.uploadFiles([new File(['test'], 'trace.txt')]) : service.sendMessage('Hello');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 0, 'Request must wait for the socket');
    resolveConnection('ready-socket');
    await pending;
    for (const request of calls) {
      const socketId = upload ? request.body.get('socketId') : JSON.parse(request.body).socketId;
      assert.equal(socketId, 'ready-socket');
    }
  }
  calls.length = 0;
  const unavailable = new N8nChatService('https://example.invalid/chat');
  unavailable.setSocketConnector(async () => { throw new Error('TEST_SOCKET_UNAVAILABLE'); });
  const originalError = console.error;
  try {
    console.error = () => {};
    await assert.rejects(unavailable.sendMessage('Hello'), /TEST_SOCKET_UNAVAILABLE/);
    await assert.rejects(unavailable.uploadFiles([new File(['test'], 'trace.txt')]), /TEST_SOCKET_UNAVAILABLE/);
    assert.equal(calls.length, 0, 'No POST with an unavailable reply channel');
  } finally { console.error = originalError; }

  const connections = [];
  const createFakeSocket = (url, options) => {
    const fakeSocket = new EventEmitter();
    fakeSocket.connected = false;
    fakeSocket.targetUrl = url;
    fakeSocket.io = { opts:options };
    fakeSocket.connect = () => fakeSocket;
    fakeSocket.disconnect = () => {
      fakeSocket.connected = false;
      fakeSocket.disconnected = true;
      return fakeSocket;
    };
    fakeSocket.finishConnection = () => {
      fakeSocket.id = `connection-${connections.indexOf(fakeSocket)}`;
      fakeSocket.connected = true;
      fakeSocket.emit('connect');
    };
    connections.push(fakeSocket);
    return fakeSocket;
  };
  const socketFilename = path.join(frontend, 'src/services/socketService.ts');
  const socketModule = new Module(socketFilename, module);
  socketModule.filename = socketFilename;
  socketModule.paths = Module._nodeModulePaths(path.dirname(socketFilename));
  socketModule.require = name => name === 'socket.io-client' ? {io:createFakeSocket}
    : name === './chatEnvelope' ? {decodeChatEnvelope:value => value} : frontendRequire(name);
  socketModule._compile(ts.transpileModule(fs.readFileSync(socketFilename, 'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText, socketFilename);
  const socket = new socketModule.exports.SocketService('https://example.invalid', 'cancelled-session');
  const connecting = socket.connect();
  const cancelled = assert.rejects(connecting, /SOCKET_CONNECTION_CANCELLED/);
  socket.disconnect();
  await cancelled;

  for (const [address, origin, transportPath] of [
    ['http://172.26.129.186/socket.io/', 'http://172.26.129.186', '/socket.io/'],
    ['https://portal.example/relay/socket.io', 'https://portal.example', '/relay/socket.io/'],
    ['https://portal.example', 'https://portal.example', '/socket.io/'],
  ]) {
    const service = new socketModule.exports.SocketService(address, 'transport-test');
    const pending = service.connect();
    const transport = connections.at(-1);
    assert.equal(transport.targetUrl, origin, 'Engine path must not become a Socket.IO namespace');
    assert.equal(transport.io.opts.path, transportPath);
    transport.finishConnection();
    await pending;
    service.disconnect();
  }

  // Execute the component helper with the real SocketService and a fake
  // transport. Session changes must perform a fresh handshake and cancel old
  // requests; repeated sends within one session must reuse its connection.
  const component = ts.createSourceFile('WeaveAiChat.tsx', fs.readFileSync(
    path.join(frontend, 'src/components/WeaveAiChat.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let helper;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(component) === 'ensureChatSocketConnection') {
      helper = node.initializer.arguments[0].getText(component);
    }
    ts.forEachChild(node, visit);
  };
  visit(component);
  assert.ok(helper);
  const jsHelper = ts.transpileModule('module.exports = '+helper, {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText;
  const a = { getSessionId:() => 'general-session', setSocketId:id => { a.socketId = id; } };
  const b = { getSessionId:() => 'document-session', setSocketId:id => { b.socketId = id; } };
  const currentChat = {current:a}, socketRef = {current:null};
  const context = {exports:{}};
  const ensure = new Function('module','isWebSocketEnabled','WEBSOCKET_URL','chatService','socketServiceRef',
    'socketHandlersAttachedRef','socketConnectSessionRef','handleWebSocketMessageRef','SocketService',jsHelper+';return module.exports;')(
    context,true,'https://example.invalid',currentChat,socketRef,{current:false},{current:null},{current:() => {}},
    socketModule.exports.SocketService);
  const oldConnection = ensure(a);
  const generalTransport = connections.at(-1);
  assert.equal(generalTransport.io.opts.query.sessionId, 'general-session');
  const stale = assert.rejects(oldConnection, /SOCKET_CONNECTION_CANCELLED/);
  currentChat.current = b;
  const newConnection = ensure(b);
  const documentTransport = connections.at(-1);
  assert.notEqual(documentTransport, generalTransport);
  assert.equal(generalTransport.disconnected, true);
  assert.equal(generalTransport.listenerCount('n8n_response'), 0);
  assert.equal(documentTransport.io.opts.query.sessionId, 'document-session');
  documentTransport.finishConnection();
  await stale;
  assert.equal(await newConnection, documentTransport.id);
  assert.equal(a.socketId, undefined);
  assert.equal(b.socketId, documentTransport.id);
  assert.equal(documentTransport.listenerCount('n8n_response'), 1);
  assert.equal(socketRef.current.getSessionId(), 'document-session');
  const connectionCount = connections.length;
  assert.equal(await ensure(b), documentTransport.id);
  assert.equal(connections.length, connectionCount, 'Same-session sends reuse the connection');

  // History can change the session on the existing service object.
  b.getSessionId = () => 'history-session';
  const historyConnection = ensure(b);
  const historyTransport = connections.at(-1);
  assert.equal(documentTransport.disconnected, true);
  assert.equal(historyTransport.io.opts.query.sessionId, 'history-session');
  assert.equal(b.socketId, null, 'Do not send the previous session socket ID');
  historyTransport.finishConnection();
  assert.equal(await historyConnection, historyTransport.id);
  assert.equal(b.socketId, historyTransport.id);
  socketRef.current.disconnect();
  console.log('PASS: request trace/retries; socket readiness/failure/cancellation; service/history switches open session-specific connections; same-session sends reuse one connection.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
