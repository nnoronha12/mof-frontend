/** Real React/DOM interactions against the real service adapter and n8n DTOs. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {createRequire}=Module;
const ts=require('typescript');
const {randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const domRequire=process.argv[2]?createRequire(path.join(process.argv[2],'package.json')):require;
const {JSDOM}=domRequire('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost:3000/'});
global.window=dom.window;global.document=dom.window.document;
for(const name of ['Node','HTMLElement','MutationObserver','Event','KeyboardEvent','MouseEvent'])global[name]=dom.window[name];
Object.defineProperty(global,'navigator',{configurable:true,value:dom.window.navigator});
global.getComputedStyle=dom.window.getComputedStyle;global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');
const {render,screen,fireEvent,waitFor,cleanup,act}=require('@testing-library/react');
const {I18nextProvider}=require('react-i18next');
const i18n=require('i18next').createInstance();
i18n.init({lng:'en',initImmediate:false,resources:Object.fromEntries(['en','ar'].map(lang=>[lang,{translation:JSON.parse(fs.readFileSync(path.join(root,`src/LanguagesContent/${lang}.json`),'utf8'))}]))});
const {promptReply}=require('./test-support/saved-prompts.cjs');
const store=new Map(),requests=[];
let owner='owner-a',failNext='',deferNextList=false,pendingOldList;
const response=(context,rows)=>{const result=promptReply(context,rows);return new Response(JSON.stringify(result.body),{status:result.status,headers:{'Content-Type':'application/json'}});};
const authFetch=async(url,options)=>{
  assert.equal(url,'https://example.invalid/ai/user/prompts');
  const body=JSON.parse(options.body);assert.equal(body.ownerId,undefined);assert.equal(body.userId,undefined);
  requests.push(body);const account=owner;
  if(failNext===body.action){failNext='';return new Response('{}',{status:503});}
  let rows=[];
  if(body.action==='save'){
    const old=[...store.values()].find(p=>p.owner===account&&p.content===body.content);
    const row={...old,id:old?.id||randomUUID(),title:body.title,content:body.content,owner:account,updatedAt:new Date().toISOString()};store.set(row.id,row);rows=[row];
  }else if(body.action==='list'){
    rows=[...store.values()].filter(p=>p.owner===account&&(!body.search||(p.title+' '+p.content).toLowerCase().includes(body.search.toLowerCase())));
    if(deferNextList){deferNextList=false;return new Promise(resolve=>{pendingOldList=()=>resolve(response(body,rows));});}
  }else if(body.action==='delete'){
    const row=store.get(body.id);if(row?.owner===account){rows=[row];store.delete(row.id);}
  }
  return response(body,rows);
};
const originalLoad=Module._load;
Module._load=function(request,parent,...rest){if(request==='./authSession'&&parent?.filename.endsWith('/services/savedPrompts.ts'))return{authFetch};return originalLoad.call(this,request,parent,...rest);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,filename)=>{
  m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,filename);
};
const {SavedPromptsPanel}=require('../src/components/SavedPromptsPanel.tsx');
const {PromptSaveMenu}=require('../src/components/PromptSaveMenu.tsx');
const {ComposerAddMenu}=require('../src/components/ComposerAddMenu.tsx');
const {insertSavedPrompt,requestSavedPrompts}=require('../src/services/savedPrompts.ts');
const progress=message=>{if(process.env.MOF_TEST_DEBUG)console.log(message);};
const sourceText='Summarise the project using bullet points.';
let attachments=0,uses=0;
function Harness({account}){
  const [actions,setActions]=React.useState([]),[open,setOpen]=React.useState(false),[text,setText]=React.useState(null),[draft,setDraft]=React.useState('My unsent draft');
  const close=React.useCallback(()=>{setOpen(false);setText(null);},[]);
  const action=actions.find(a=>a.action==='prompt.save');
  return React.createElement(I18nextProvider,{i18n},React.createElement(React.Fragment,null,
    React.createElement(ComposerAddMenu,{disabled:false,canAttach:true,onAttachment:()=>attachments++,onSavedPrompts:()=>setOpen(true)}),
    action&&React.createElement(PromptSaveMenu,{action,onSave:()=>setText(sourceText)}),
    React.createElement('textarea',{'aria-label':'Composer',value:draft,onChange:event=>setDraft(event.target.value)}),
    React.createElement(SavedPromptsPanel,{baseUrl:'https://example.invalid/ai/',ownerKey:account,open:open||text!==null,saveText:text,onClose:close,onActions:setActions,onUse:content=>{uses++;setDraft(insertSavedPrompt(draft,content));}})));
}
const openList=async()=>{fireEvent.click(screen.getByRole('button',{name:i18n.t('savedPrompts.add')}));fireEvent.click(screen.getByRole('menuitem',{name:i18n.t('savedPrompts.title')}));await screen.findByRole('dialog');};
const openSave=async()=>{fireEvent.click(await screen.findByRole('button',{name:i18n.t('savedPrompts.more')}));fireEvent.click(screen.getByRole('menuitem',{name:i18n.t('savedPrompts.saveTitle')}));await screen.findByRole('dialog');};
(async()=>{
  progress('Dependencies loaded');
  assert.equal(insertSavedPrompt('','Saved'),'Saved');assert.equal(insertSavedPrompt('Draft','Saved'),'Draft\nSaved');assert.throws(()=>insertSavedPrompt('x'.repeat(12000),'y'),/PROMPT_TOO_LONG/);
  let view=render(React.createElement(Harness,{account:owner}));
  progress('Harness rendered');
  await screen.findByRole('button',{name:'More message options'});
  progress('Backend capabilities loaded');
  fireEvent.click(screen.getByRole('button',{name:'Add attachment or saved prompt'}));
  assert.equal(document.activeElement.textContent,'Add attachment');
  fireEvent.keyDown(document,{key:'ArrowDown'});assert.equal(document.activeElement.textContent,'Saved prompts');
  fireEvent.keyDown(document,{key:'Escape'});
  fireEvent.click(screen.getByRole('button',{name:'Add attachment or saved prompt'}));fireEvent.click(screen.getByRole('menuitem',{name:'Add attachment'}));assert.equal(attachments,1);
  await openSave();
  progress('Save dialog opened');
  assert.equal(screen.getByLabelText('Prompt text').value,sourceText);
  fireEvent.change(screen.getByLabelText('Prompt name'),{target:{value:'Project summary'}});
  fireEvent.change(screen.getByLabelText('Prompt text'),{target:{value:"Summarise Falcon 42\nKeep 'quoted' facts."}});
  failNext='save';fireEvent.click(screen.getByRole('button',{name:'Save prompt'}));
  await screen.findByRole('alert');assert.equal(screen.getByLabelText('Prompt text').value,"Summarise Falcon 42\nKeep 'quoted' facts.");
  fireEvent.click(screen.getByRole('button',{name:'Save prompt'}));await waitFor(()=>assert.ok(!screen.queryByRole('dialog'),'Dialog should close'));assert.equal(store.size,1);
  progress('Save/retry complete');
  await openList();const use=await screen.findByRole('button',{name:'Use: Project summary'});fireEvent.click(use);
  await waitFor(()=>assert.ok(!screen.queryByRole('dialog'),'Dialog should close'));assert.equal(screen.getByLabelText('Composer').value,"My unsent draft\nSummarise Falcon 42\nKeep 'quoted' facts.");assert.equal(uses,1);
  assert.ok(requests.every(r=>['list','save','delete'].includes(r.action)),'Reusing must not call chat/send');
  progress('Reuse complete');
  // Unmounting loses all local component state; the next list comes from storage.
  cleanup();view=render(React.createElement(Harness,{account:owner}));await openList();await screen.findByRole('button',{name:'Use: Project summary'});
  fireEvent.change(screen.getByRole('textbox',{name:'Search saved prompts'}),{target:{value:'not present'}});
  await screen.findByText('No matching prompts in this list.');
  fireEvent.change(screen.getByRole('textbox',{name:'Search saved prompts'}),{target:{value:''}});await screen.findByRole('button',{name:'Use: Project summary'});
  fireEvent.click(screen.getByRole('button',{name:'Delete: Project summary'}));fireEvent.click(screen.getByRole('button',{name:'Cancel'}));assert.equal(store.size,1);
  fireEvent.click(screen.getByRole('button',{name:'Delete: Project summary'}));fireEvent.click(screen.getByRole('button',{name:'Delete',exact:true}));
  await screen.findByText('No saved prompts yet. Use the three-dot menu beside a message to save one.');assert.equal(store.size,0);
  fireEvent.click(screen.getByRole('button',{name:'Close'}));
  await act(async()=>{await i18n.changeLanguage('ar');});await openSave();
  assert.equal(screen.getByRole('dialog').getAttribute('dir'),'rtl');
  fireEvent.change(screen.getByLabelText('اسم المطالبة'),{target:{value:'ملخص المشروع'}});fireEvent.change(screen.getByLabelText('نص المطالبة'),{target:{value:'لخّص المشروع بالعربية مع الحفاظ على الأرقام.'}});
  fireEvent.click(screen.getByRole('button',{name:'حفظ المطالبة'}));await waitFor(()=>assert.ok(!screen.queryByRole('dialog'),'Dialog should close'));
  const id=[...store.keys()][0];
  // A late list from the previous account must not repopulate the next user's list.
  deferNextList=true;await openList();await waitFor(()=>assert.ok(pendingOldList));
  owner='owner-b';view.rerender(React.createElement(Harness,{account:owner}));
  await act(async()=>{pendingOldList();await new Promise(resolve=>setTimeout(resolve,0));});
  await openList();await screen.findByText(i18n.t('savedPrompts.empty'));assert.ok(!screen.queryByText('ملخص المشروع'),'Previous owner prompt must be hidden');
  await assert.rejects(requestSavedPrompts('https://example.invalid/ai',{action:'delete',language:'en',id}),error=>error.status===404);
  assert.equal(store.size,1,'Another owner cannot delete the saved prompt');
  cleanup();dom.window.close();
  console.log('PASS: actual React menus/keyboard, editable save, failed-save retry, backend-backed reload/search/delete, draft-preserving reuse without sending, Arabic/RTL and stale-account isolation.');
})().catch(error=>{cleanup();console.error(error);process.exitCode=1;});
