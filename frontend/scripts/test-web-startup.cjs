/** Execute the built production scripts through the generated HTML; no real network. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');
const {publicBasePath}=require('../config/portalConfig.cjs').loadPortalConfig();
const dist=path.resolve(__dirname,'../dist'),html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(dist,'entrypoints.json'),'utf8'));
class Assets extends ResourceLoader {
  constructor(){super();this.loaded=[];}
  fetch(address){
    const url=new URL(address);
    if(url.origin!=='https://portal.invalid')return null;
    const file=path.join(dist,url.pathname.startsWith(publicBasePath) ? url.pathname.slice(publicBasePath.length) : url.pathname.slice(1));
    assert.ok(file.startsWith(dist+path.sep),'Asset path escaped dist');
    assert.ok(fs.existsSync(file),'Missing build asset: '+url.pathname);
    this.loaded.push({name:path.basename(file),bytes:fs.statSync(file).size});
    return Promise.resolve(fs.readFileSync(file));
  }
}
(async()=>{
 for(const route of [publicBasePath,publicBasePath+'inquiry-document/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?page=2']){
  const assets=new Assets(),errors=[];const console=new VirtualConsole();
  console.on('error',(...args)=>errors.push(args.map(value=>value?.stack||String(value)).join(' ')));
  console.on('jsdomError',error=>{if(!/css.*pars/i.test(error.type||''))errors.push(error.message);});
  const dom=new JSDOM(html,{url:'https://portal.invalid'+route,resources:assets,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,
   beforeParse(window){window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});window.fetch=async()=>{throw new Error('Unexpected API request before sign-in');};}});
  const deadline=Date.now()+10000;
  while(!dom.window.document.querySelector('input[type="password"]')&&!dom.window.document.querySelector('#root [role="alert"]')&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
  assert.ok(dom.window.document.querySelector('input[type="password"]'),'Production login did not mount on '+route+'; errors: '+JSON.stringify(errors)+'; root: '+dom.window.document.getElementById('root')?.textContent+'; assets: '+assets.loaded.map(a=>a.name).join(','));
  assert.deepEqual(errors,[],'Production script error');
  assert.deepEqual(assets.loaded.slice(0,manifest.scripts.length).map(a=>a.name),manifest.scripts,'Initial chunks loaded out of order');
  const bytes=assets.loaded.filter(a=>a.name.endsWith('.js')).reduce((sum,a)=>sum+a.bytes,0);
  assert.ok(bytes<512*1024,'Login loaded the heavy chat application eagerly');
  dom.window.close();
  process.stdout.write(`PASS: built portal boots at ${route}; ordered scripts and deferred chat; ${(bytes/1024).toFixed(0)} KiB JavaScript to login.\n`);
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
