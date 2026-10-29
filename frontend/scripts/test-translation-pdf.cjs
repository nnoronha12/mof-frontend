const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const ts=require('typescript'),{JSDOM}=require('jsdom');const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://portal.invalid'});
for(const k of ['window','document','navigator','HTMLElement','DOMParser'])Object.defineProperty(global,k,{configurable:true,value:dom.window[k]});global.IS_REACT_ACT_ENVIRONMENT=true;
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,file);
const React=require('react'),{render,fireEvent,screen,waitFor,cleanup}=require('@testing-library/react');
const {TranslationViewer}=require('../src/components/TranslationViewer.tsx');const {translationDisplayHtml}=require('../src/services/translationWorkflow.ts');
const jobId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',base='https://example.invalid/translate',query='?jobId='+jobId+'&k=12345678abcdef12';
const result={jobId,viewKey:'12345678abcdef12',status:'done',html:'<section class="tr-page" data-page="1"><h1>Fixture</h1></section>',links:{pdf:base+'/export'+query,html:base+'/document'+query+'&download=1',view:base+'/document'+query}};
const actions=[{id:'pdf',action:'translation.download',actionButtonType:'download',label:'Download translated PDF',payload:{jobId,format:'pdf'}},{id:'html',action:'translation.download',actionButtonType:'download',label:'Download HTML',payload:{jobId,format:'html'}}];
let downloads=0;global.fetch=async()=>{downloads++;return{ok:true,blob:async()=>new Blob(['%PDF-fixture'])}};global.URL.createObjectURL=()=> 'blob:fixture';global.URL.revokeObjectURL=()=>{};dom.window.HTMLAnchorElement.prototype.click=function(){};
(async()=>{
 for(const isArabic of [false,true]){
  const view=render(React.createElement(TranslationViewer,{result,actions,isArabic,onClose:()=>{}}));
  assert.equal(screen.queryByRole('button',{name:'Download HTML'}),null);
  const pdf=screen.getByRole('button',{name:'Download translated PDF'});assert.equal(pdf.tagName,'BUTTON');fireEvent.click(pdf);await waitFor(()=>assert.equal(pdf.disabled,false));assert.ok(downloads>0);assert.equal(view.container.querySelector('aside').dir,isArabic?'rtl':'ltr');cleanup();
 }
 render(React.createElement(TranslationViewer,{result,actions:[],isArabic:false,onClose:()=>{}}));assert.equal(screen.queryByRole('button',{name:/Download/}),null);cleanup();
 render(React.createElement(TranslationViewer,{result,actions:actions.map(a=>({...a,payload:{...a.payload,jobId:'wrong'}})),isArabic:false,onClose:()=>{}}));assert.equal(screen.queryByRole('button',{name:/Download/}),null);cleanup();
 const legacy='<p>Ready <a href="'+result.links.pdf+'">PDF</a><a href="'+result.links.html+'">Download HTML</a><a href="https://other.invalid">Other</a></p>';
 const cleaned=translationDisplayHtml(legacy,result,actions);assert.ok(!cleaned.includes('Download HTML'));assert.ok(!cleaned.includes('>PDF<'));assert.ok(cleaned.includes('other.invalid'));assert.equal(translationDisplayHtml(legacy,null,actions),legacy);
 console.log('PASS: translation PDF is a real backend-gated button; HTML download absent even for legacy actions; correct job required; English/Arabic layout; actual download invoked; unrelated links preserved.');
})().catch(e=>{console.error(e);process.exitCode=1;});
