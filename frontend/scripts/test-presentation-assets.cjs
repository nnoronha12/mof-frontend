// Slide images and HTML files work wherever a deck was generated:
// - every stored asset address (n8n host:port, a gateway's /ai prefix, relative, {{baseURL}}) points at this portal's own asset route;
// - sanitised HTML opened or saved as a file declares UTF-8, so “ and Arabic are not read as Windows-1252.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ts = require('typescript'), { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://172.26.129.186/frontend/' });
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'DOMParser', 'Node']) Object.defineProperty(global, k, { configurable: true, value: dom.window[k] });
global.__MOF_PORTAL_CONFIG__ = require('../config/portalConfig.cjs').loadPortalConfig();
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText, file);

const { resolvePresentationAssetUrls, sanitizePresentationHtml, buildCoverSlideHtml } = require('../src/components/presentationPreview.ts');
const { ensureUtf8Charset, HTML_FILE_TYPE } = require('../src/utils/htmlFile.ts');
const { getPptAssetBaseUrl } = require('../src/constants/chatConstants.ts');
const base = getPptAssetBaseUrl();
assert.equal(base, global.__MOF_PORTAL_CONFIG__.apiBaseUrl + '/ppt/asset?path=');

// 1. Asset addresses
const stored = [
  'http://172.26.129.185:5678/webhook/ppt/asset?path=',   // n8n host and port (not reachable from browsers)
  'http://172.26.129.185/webhook/ppt/asset?path=',        // MOF API, already right
  'http://10.16.108.10:5678/webhook/ppt/asset?path=',     // UAT internal n8n
  'https://uat-esolutions.solutionsplus.ae/ai/ppt/asset?path=', // UAT gateway
  'http://localhost:5678/ai/ppt/asset?path=',
  '/webhook/ppt/asset?path=', '/ai/ppt/asset?path=',       // relative
  '{{baseURL}}/ai/ppt/asset?path=', '{{baseURL}}/webhook/ppt/asset?path=',
];
for (const s of stored) {
  const html = `<img src="${s}assets/brand/logo.png"><div style="background-image:url('${s}assets/photos/city.jpg')"></div><i style="background:url(${s}assets/brand/p.svg)"></i>`;
  const out = resolvePresentationAssetUrls(html);
  assert.equal(out, `<img src="${base}assets/brand/logo.png"><div style="background-image:url('${base}assets/photos/city.jpg')"></div><i style="background:url(${base}assets/brand/p.svg)"></i>`, s);
  assert.equal(resolvePresentationAssetUrls(out), out, 'rewriting twice changes nothing: ' + s);
}
const unrelated = '<a href="https://example.com/webhook/other?path=x">x</a><img src="https://cdn.example/ppt/asset.png"><p>/ai/ppt/assets are mentioned in text</p>';
assert.equal(resolvePresentationAssetUrls(unrelated), unrelated, 'other URLs and text are left alone');

// 2. Charset after sanitising (DOMPurify drops <meta>)
const deck = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>عرض</title><style>.q:before{content:"“"}</style></head>'
  + '<body><section class="slide"><p>“Our goal” — وزارة المالية</p><img src="http://172.26.129.185:5678/webhook/ppt/asset?path=assets/brand/x.png"></section></body></html>';
const clean = sanitizePresentationHtml(resolvePresentationAssetUrls(deck));
assert.ok(!/<meta[^>]*charset/i.test(clean), 'DOMPurify removes <meta charset> (the cause of â€œ)');
const fixed = ensureUtf8Charset(clean);
assert.equal((fixed.match(/<meta charset="utf-8">/g) || []).length, 1);
assert.ok(/<head[^>]*><meta charset="utf-8">/i.test(fixed), 'meta charset is the first thing in <head>');
assert.ok(fixed.includes('“Our goal”') && fixed.includes('وزارة المالية'), 'quotes and Arabic survive');
assert.ok(fixed.includes(base + 'assets/brand/x.png'));
assert.equal(ensureUtf8Charset(fixed), fixed, 'not added twice');
assert.ok(ensureUtf8Charset('<p>نص</p>').startsWith('<meta charset="utf-8">'), 'fragments get it too');
assert.equal(HTML_FILE_TYPE, 'text/html;charset=utf-8');

// 3. No HTML blob is created without a charset
for (const file of ['../src/components/PresentationViewer.tsx', '../src/components/TranslationViewer.tsx']) {
  const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
  assert.ok(!/type:\s*['"]text\/html['"]/.test(src), file + ' still creates text/html without a charset');
  assert.ok(src.includes('HTML_FILE_TYPE') && src.includes('ensureUtf8Charset'), file);
}

// 4. The cover thumbnail uses the portal's asset route too
const cover = buildCoverSlideHtml(deck);
assert.ok(cover.includes(base + 'assets/brand/x.png') && !cover.includes(':5678'));

console.log('PASS: asset addresses from any environment point at ' + base + '; HTML files declare UTF-8 (“ and Arabic intact); no charset-less HTML blobs.');
