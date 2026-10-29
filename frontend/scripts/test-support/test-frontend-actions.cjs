const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const frontend = path.resolve(__dirname, '../..');
const frontendRequire = createRequire(path.join(frontend, 'package.json'));
const ts = frontendRequire('typescript');
const Module = require('node:module');
const compile = filename => {
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  m._compile(output, filename);
  return m.exports;
};
// Unit-test TS/TSX directly without opening or automating a browser.
require.extensions['.ts'] = (m, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText;
  m._compile(output, filename);
};
const { backendActions, decodeChatEnvelope } = compile(path.join(frontend, 'src/services/chatEnvelope.ts'));
let checks = 0;
for (const value of [undefined, null, {}, [], { buttons: [] }]) {
  assert.deepEqual(backendActions(value), []); checks++;
}
assert.deepEqual(decodeChatEnvelope({ output: '<section data-mof-meeting="33333333-3333-4333-8333-333333333333">Ready</section>' }).actionButtons.buttons, []); checks++;
assert.deepEqual(backendActions([{ id: 'x', label: 'Unknown', actionButtonType: 'execute', action: 'arbitrary.execute', payload: {} }]), []); checks++;
assert.deepEqual(backendActions([{ id: 'x', label: 'Missing payload', actionButtonType: 'reference', action: 'reference.open' }]), []); checks++;
for (const button of [
  { label: 'Copy answer', actionButtonType: 'copy' },
  { label: 'نسخ الإجابة', actionButtonType: 'copy', action: 'message.copy' },
  { label: 'Copy answer', actionButtonType: 'copy', action: 'message.copy', payload: {} },
]) {
  const actions = backendActions([button]);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].action, 'message.copy');
  assert.deepEqual(actions[0].payload, {});
  checks += 3;
}
assert.deepEqual(backendActions([{label:'Copy',actionButtonType:'copy',action:'email.copy'}]), []); checks++;
assert.deepEqual(backendActions([{label:'Copy',actionButtonType:'copy',action:'message.copy',payload:[]}]), []); checks++;
assert.deepEqual(backendActions([{ id: 'x', label: 'Unsafe reference', actionButtonType: 'reference', action: 'reference.open', payload: { documentId: '77777777-7777-4777-8777-777777777777', page: 1, href: 'https://example.invalid/' } }]), []); checks++;
const example = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'examples', name+'.json')));
const inquiry = decodeChatEnvelope(example('inquiry'));
const reference = inquiry.actionButtons.buttons.find(a => a.action === 'reference.open');
assert.ok(reference); assert.equal(reference.payload.page, 2); assert.equal(reference.payload.href, inquiry.citations[0].url); checks+=3;
const noActions = example('email'); noActions.actionButtons.buttons = [];
assert.deepEqual(decodeChatEnvelope(noActions).actionButtons.buttons, []); checks++;
const simpleDownload = {output:'Ready', sessionDetails:{messageId:'102',sessionId:'s',userMessageId:'101',aiMessageId:'102',weaveChatid:42,chatLock:false},actionButtons:{buttons:[{label:'Download',actionButtonType:'download',file_id:'file-1',mimetype:'application/pdf'}]}};
assert.equal(decodeChatEnvelope(simpleDownload).actionButtons.buttons[0].mimetype, 'application/pdf'); checks++;
for (const name of ['email','chart','presentation','translation','proposal']) {
  const decoded=decodeChatEnvelope(example(name));
  const field={email:'emailDraft',chart:'sessionDetails',presentation:'presentation',translation:'translation',proposal:'recommendation'}[name];
  assert.ok(decoded[field]); checks++;
}
const accepted=decodeChatEnvelope(example('accepted'));
assert.equal(accepted.sessionDetails.chatLock,true); assert.deepEqual(accepted.actionButtons.buttons,[]);checks+=2;
const translated=decodeChatEnvelope({...example('translation'),sessionDetails:{...example('translation').sessionDetails,chatLock:true},actionButtons:{buttons:example('translation').actionButtons.buttons.map(b=>b.action==='translation.open'?{...b,payload:{...b.payload,translation:{...b.payload.translation,status:'accepted'}}}:b)}});
assert.equal(translated.eventType,'accepted');assert.ok(translated.translation.jobId);assert.deepEqual(translated.actionButtons.buttons,[]);checks+=3;
const React = frontendRequire('react');
const { renderToStaticMarkup } = frontendRequire('react-dom/server');
const i18n = frontendRequire('i18next').createInstance();
const { I18nextProvider } = frontendRequire('react-i18next');
i18n.init({ lng: 'en', initImmediate: false, resources: { en: { translation: { emailDraft: { title: 'Email draft', subject: 'Subject', copied: 'Copied' } } } } });
const { EmailDraftCard } = compile(path.join(frontend, 'src/components/EmailDraftCard.tsx'));
const draft = decodeChatEnvelope(example('email')).emailDraft;
const render = actions => renderToStaticMarkup(React.createElement(I18nextProvider, { i18n }, React.createElement(EmailDraftCard, { draft, actions })));
assert.ok(!render(undefined).includes('<button')); checks++;
assert.ok(!render([]).includes('<button')); checks++;
assert.ok(render(example('email').actionButtons.buttons).includes('<button')); checks++;
assert.ok(!render([{ id:'email.copy', label:'Copy', action:'email.copy', actionButtonType:'copy', payload:{emailId:'another-result'} }]).includes('<button')); checks++;
console.log('PASS:',checks,'frontend action checks, including rendered email with no/empty/mismatched backend actions and structured Inquiry references.');
