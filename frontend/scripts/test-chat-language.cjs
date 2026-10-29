/** Exercise the real active-chat header and language selector together. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window; global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement; global.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(global, 'navigator', { configurable: true, value: dom.window.navigator });
const React = require('react');
const { render, screen, fireEvent, cleanup } = require('@testing-library/react');
const languageFile = path.resolve(__dirname, '../src/components/LanguageToggle.tsx');
const moduleValue = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(languageFile, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText)(require, moduleValue, moduleValue.exports);
const { LanguageToggle } = moduleValue.exports;
const source = ts.createSourceFile('WeaveAiChat.tsx', fs.readFileSync(path.resolve(__dirname, '../src/components/WeaveAiChat.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let header;
const visit = node => {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'renderChatHeaderActions') header = node.initializer.getText(source);
  ts.forEachChild(node, visit);
};
visit(source); assert.ok(header, 'Active-chat header must exist');
const code = ts.transpileModule('const renderHeader = ' + header, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;
const makeHeader = new Function('React', 'LanguageToggle', 'UserGroupIcon', 'onLanguageChange', 'canShowShareChat', 'IsArabicLanguage', 'themeColors', 'setIsShareModalOpen', 't', 'twMerge', 'isPresentationActive', 'isCompactDeckHistory', 'isDeckHistoryOpen', code + ';return renderHeader;');
let shareOpened = 0, languageChanges = [];
function Header({ share = true, language = true }) {
  const [arabic, setArabic] = React.useState(false);
  return makeHeader(React, LanguageToggle, () => null,
    language ? next => { languageChanges.push(next); setArabic(next); } : undefined,
    share, arabic, { primary: '#C6A75D' }, value => { if (value) shareOpened++; },
    () => arabic ? 'مشاركة المحادثة' : 'Share chat', require('tailwind-merge').twMerge, false, false, false)();
}
try {
  render(React.createElement(Header));
  assert.equal(screen.getByRole('button', { name: 'Switch interface to English' }).getAttribute('aria-pressed'), 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Switch interface to Arabic' }));
  assert.deepEqual(languageChanges, [true]); assert.equal(shareOpened, 0, 'Language selection must not open sharing');
  assert.equal(screen.getByRole('button', { name: 'تبديل الواجهة إلى العربية' }).getAttribute('aria-pressed'), 'true');
  fireEvent.click(screen.getByRole('button', { name: 'مشاركة المحادثة' }));
  assert.equal(shareOpened, 1); assert.deepEqual(languageChanges, [true], 'Share must not change the UI language');
  fireEvent.click(screen.getByRole('button', { name: 'تبديل الواجهة إلى الإنجليزية' }));
  assert.deepEqual(languageChanges, [true, false]);
  assert.equal(screen.getByRole('button', { name: 'Switch interface to English' }).getAttribute('aria-pressed'), 'true');
  cleanup();
  render(React.createElement(Header, { share: false }));
  assert.ok(screen.getByRole('group', { name: 'Interface language' }));
  assert.equal(screen.queryByRole('button', { name: 'Share chat' }), null);
  fireEvent.click(screen.getByRole('button', { name: 'Switch interface to Arabic' }));
  assert.equal(languageChanges.at(-1), true, 'Service chats without sharing still allow language selection');
  cleanup();
  render(React.createElement(Header, { language: false }));
  assert.equal(screen.queryByRole('group', { name: 'Interface language' }), null);
  fireEvent.click(screen.getByRole('button', { name: 'Share chat' })); assert.equal(shareOpened, 2);
  cleanup();
  const empty = render(React.createElement(Header, { share: false, language: false }));
  assert.equal(empty.container.childElementCount, 0);
  console.log('PASS: active-chat EN/AR selection, selected state and Arabic labels, independent Share interaction, language controls available in non-shareable service chats.');
} finally { cleanup(); dom.window.close(); }
