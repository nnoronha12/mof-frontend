/** Check the production container assets. Never print credential values. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {publicBasePath}=require('../config/portalConfig.cjs').loadPortalConfig();
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(directory,entry.name);
  assert.ok(!entry.isSymbolicLink(),'Publish directory must not contain symlinks');
  return entry.isDirectory()?walk(file):[file];
});
const files=walk(dist);
for(const file of files){
  const relative=path.relative(dist,file);
  assert.ok(!/(^|[/\\])(?:\.git|node_modules|backend|\.env(?:\.|$))|(?:\.map|\.pem|\.key)$|(?:^|[/\\])(?:package(?:-lock)?\.json|AGENTS\.md)$/i.test(relative),'Unexpected publish file: '+relative);
  const bytes=fs.readFileSync(file);
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(bytes.toString('utf8')),'Token-like content found in publish file: '+relative);
}
const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
const {scripts}=JSON.parse(fs.readFileSync(path.join(dist,'entrypoints.json'),'utf8'));
assert.ok(Array.isArray(scripts)&&scripts.length>0,'Missing initial script manifest');
assert.equal(new Set(scripts).size,scripts.length,'Duplicate initial script');
const actualScripts=[...html.matchAll(/<script defer src="\/([^"<>]+)"><\/script>/g)].map(match=>('/'+match[1]).slice(publicBasePath.length));
assert.deepEqual(actualScripts,scripts,'HTML must load every initial chunk exactly once, in dependency order');
for(const script of scripts){assert.match(script,/^[a-zA-Z0-9._-]+\.js$/);assert.ok(fs.existsSync(path.join(dist,script)),'Missing initial chunk');}
const chunks=files.map(file=>path.relative(dist,file)).filter(file=>/^[^/]+\.[0-9a-f]{8}\.js$/.test(file)).sort();
assert.ok(chunks.length>0,'Missing content-hashed JavaScript');
assert.ok(!html.includes('src="/main.js"'),'Stale unversioned entry script');
const bundle=files.filter(file=>file.endsWith('.js')).map(file=>fs.readFileSync(file,'utf8')).join('\n');
const config=require('../config/portalConfig.cjs').loadPortalConfig();
assert.ok(bundle.includes(config.apiBaseUrl),'Bundle API differs from selected build configuration');
if(config.websocketUrl)assert.ok(bundle.includes(config.websocketUrl),'Bundle socket URL differs from selected build configuration');
assert.ok(!/uat-esolutions\.solutionsplus\.ae|up\.railway\.app|mof-code\.netlify\.app|10\.16\.108\.10/i.test(bundle),'Old environment URL in production bundle');
for(const file of ['_headers','_redirects'])assert.ok(!fs.existsSync(path.join(dist,file)),'Unexpected hosting artifact: '+file);
console.log(`PASS: ${files.length} publish files; expected app/config/SPA fallback; no source maps, private build files, token-like content.`);
