const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const compile = relative => {
  const filename = path.join(root, relative);
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React},
  }).outputText, filename);
  return m.exports;
};
const { copyText } = compile('src/utils/copyText.ts');
const { backendActions } = compile('src/services/chatEnvelope.ts');
const source = ts.createSourceFile('WeaveAiChat.tsx', fs.readFileSync(path.join(root,
  'src/components/WeaveAiChat.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = {};
const visit = node => {
  if (ts.isVariableDeclaration(node) && ['handleCopyMessage','renderMessageActions'].includes(node.name.getText(source))) {
    const initializer = node.initializer;
    functions[node.name.getText(source)] = (ts.isCallExpression(initializer) ? initializer.arguments[0] : initializer).getText(source);
  }
  ts.forEachChild(node, visit);
};
visit(source);
const bind = (name, bindings) => {
  const js = ts.transpileModule('const fn = '+functions[name], {compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,
  }}).outputText;
  return new Function(...Object.keys(bindings), js+'; return fn;')(...Object.values(bindings));
};
let written, commandResult = true, removed = false, restored = false;
const previousFocus = {focus:() => { restored = true; }};
const fakeDocument = {
  activeElement: previousFocus,
  body: {appendChild:area => { fakeDocument.area = area; }},
  getSelection:() => null,
  createElement:() => ({style:{},setAttribute(){},focus(){},select(){},setSelectionRange(){},remove(){ removed = true; }}),
  execCommand:command => { assert.equal(command, 'copy'); written = fakeDocument.area.value; return commandResult; },
};
Object.defineProperty(global, 'navigator', {configurable:true,value:{clipboard:{writeText:async text => { written = text; }}}});
global.window = {isSecureContext:true};
global.document = fakeDocument;
(async () => {
  for (const text of ['Project Falcon 42\nBudget: AED 12,500,000', 'المشروع: فالكون 42\nالميزانية: 12,500,000 درهم']) {
    assert.equal(await copyText(text), true);
    assert.equal(written, text);
  }
  navigator.clipboard.writeText = async () => { throw new Error('Permission denied'); };
  assert.equal(await copyText('Fallback answer'), true);
  assert.equal(written, 'Fallback answer');
  assert.equal(removed, true);
  assert.equal(restored, true);
  window.isSecureContext = false;
  assert.equal(await copyText('HTTP or WebView answer'), true);
  assert.equal(written, 'HTTP or WebView answer');

  let copied = null, failed = null;
  const handler = bind('handleCopyMessage', {
    copyText, setCopiedMessageId:v => { copied = typeof v === 'function' ? v(copied) : v; },
    setCopyFailedMessageId:v => { failed = typeof v === 'function' ? v(failed) : v; },
    setTimeout:() => {},
  });
  for (const language of ['en','ar']) {
    const labels = JSON.parse(fs.readFileSync(path.join(root, `src/LanguagesContent/${language}.json`), 'utf8'));
    const render = message => bind('renderMessageActions', {
      React, backendActions, handleCopyMessage:handler, stripMarkdown:text => text,
      isAiResponding:false, copiedMessageId:copied, copyFailedMessageId:failed,
      t:key => key.split('.').reduce((v,k) => v[k], labels),
      CopyIcon:props => React.createElement('svg', props), CheckIcon:props => React.createElement('svg', props), themeColors:{primary:'#b98b37'},
    })(message);
    const text = language === 'ar' ? 'هذه هي الإجابة\nالسطر الثاني' : 'This is the answer\nSecond line';
    const message = {id:`answer-${language}`,text,actionButtons:{buttons:[{label:'Copy',actionButtonType:'copy'}]}};
    assert.equal(render({...message,actionButtons:undefined}), null);
    assert.equal(render({...message,actionButtons:{buttons:[]}}), null);
    commandResult = true;
    const button = render(message).props.children[0][0];
    button.props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(written, text, 'Copy the clicked answer, not its label or another message');
    assert.equal(copied, message.id);
    assert.equal(failed, null);
    let html = renderToStaticMarkup(render(message));
    assert.ok(html.includes('<svg'));
    assert.ok(html.includes(labels.answerCopy.copied));
    assert.ok(html.includes('role="status"'));
    commandResult = false;
    await handler(text, message.id);
    html = renderToStaticMarkup(render(message));
    assert.equal(copied, null);
    assert.equal(failed, message.id);
    assert.ok(html.includes(labels.answerCopy.failed));
    const other = renderToStaticMarkup(render({...message,id:'another-answer'}));
    assert.ok(!other.includes(labels.answerCopy.failed));
  }
  console.log('PASS: answer Copy activation/content, backend gating, English/Arabic success/failure feedback, Clipboard API and permission/insecure-context fallback.');
})().catch(error => { console.error(error); process.exitCode = 1; });
