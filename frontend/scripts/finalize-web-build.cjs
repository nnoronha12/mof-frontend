/** Copy public assets, then load every initial Webpack chunk in dependency order. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {publicBasePath} = require('../config/portalConfig.cjs').loadPortalConfig();
const root = path.resolve(__dirname, '..'), dist = path.join(root, 'dist');
const { scripts } = JSON.parse(fs.readFileSync(path.join(dist, 'entrypoints.json'), 'utf8'));
assert.ok(Array.isArray(scripts) && scripts.length && new Set(scripts).size === scripts.length, 'Invalid entry manifest');
for (const file of scripts) {
  assert.match(file, /^[a-zA-Z0-9._-]+\.js$/);
  assert.ok(fs.statSync(path.join(dist, file)).isFile(), 'Missing entry chunk');
}
fs.cpSync(path.join(root, 'public'), dist, { recursive: true });
const filename = path.join(dist, 'index.html');
const html = fs.readFileSync(filename, 'utf8');
const entry = /<script\s+src=["']\/main\.js["']\s*><\/script>/g;
assert.equal([...html.matchAll(entry)].length, 1, 'Public HTML must contain exactly one app entry placeholder');
fs.writeFileSync(filename, html.replace(entry, scripts.map(file => `<script defer src="${publicBasePath}${file}"></script>`).join('\n    ')));
// Nginx owns routing and cache headers.
for (const file of ['_headers', '_redirects']) fs.rmSync(path.join(dist, file), { force: true });
console.log(`Finalized portal HTML with ${scripts.length} ordered entry scripts.`);
