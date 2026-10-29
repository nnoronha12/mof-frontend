const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const Module=require('node:module'),{createRequire}=Module;
const {execFileSync}=require('node:child_process');
const ts=require('typescript');
const domRequire=process.argv[2]?createRequire(path.join(process.argv[2],'package.json')):require;
const {JSDOM}=domRequire('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost:3000/'});
global.window=dom.window;global.document=dom.window.document;
for(const name of ['Node','HTMLElement','DOMParser','MutationObserver','Event','KeyboardEvent'])global[name]=dom.window[name];
global.ResizeObserver=class{observe(){}disconnect(){}};
Object.defineProperty(global,'navigator',{configurable:true,value:dom.window.navigator});
global.IS_REACT_ACT_ENVIRONMENT=true;
global.__MOF_PORTAL_CONFIG__=require('../config/portalConfig.cjs').loadPortalConfig();
const React=require('react');const {render,screen,fireEvent,waitFor,cleanup}=require('@testing-library/react');
const {I18nextProvider}=require('react-i18next');const i18n=require('i18next').createInstance();
i18n.init({lng:'en',initImmediate:false,resources:Object.fromEntries(['en','ar'].map(lang=>[lang,{translation:require('../src/LanguagesContent/'+lang+'.json')}]))});
const {withResultActions}=require('./test-support/result-actions.cjs');
const downloads=[],exportCalls=[];let lastBlob;
global.URL=dom.window.URL;URL.createObjectURL=blob=>{lastBlob=blob;return 'blob:fixture';};URL.revokeObjectURL=()=>{};
dom.window.HTMLAnchorElement.prototype.click=function(){downloads.push(this.download);};
const deckId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const html='<html><body><main class="deck"><section class="slide" data-slide="slide-1"><h1>Fixture slide</h1><p>Content</p></section></main></body></html>';
let savedSpec={title:'Fixture',theme:{id:'mof_classic'},slides:[{id:'slide-1',position:1,layout:'bullets',template:{id:'fixture',version:1},content:{title:'Fixture slide',body:'Content'}}]};
const serviceMocks={getPresentationCatalog:async()=>({slideTypes:[]}),getPresentationChanges:async()=>({changes:[]}),getPresentationSlideTemplates:async()=>[],
  getPresentationDeck:async()=>({deck:{id:deckId,revision:2},html,spec:savedSpec}),
  savePresentationDeck:async(descriptor,spec)=>{savedSpec=spec;return{deckId,revision:2,html};},
  exportPresentationDeck:async(descriptor,format)=>{exportCalls.push({deckId:descriptor.deckId,format});return{blob:new Blob(['fixture']),filename:'fixture.'+format};}};
const originalLoad=Module._load;
Module._load=function(request,parent,...rest){
  if(parent?.filename.endsWith('/PresentationViewer.tsx')){
    if(request==='../services/presentationWorkflow')return serviceMocks;
    if(request==='./presentationRenderer')return{renderPresentationSpec:()=>html,shufflePresentationDesign:()=>savedSpec};
    if(request==='./PresentationHistoryPanel')return{PresentationHistoryList:()=>null};
  }
  return originalLoad.call(this,request,parent,...rest);
};
for(const extension of ['.ts','.tsx'])require.extensions[extension]=(m,filename)=>m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true},
}).outputText,filename);
const {EmailDraftCard}=require('../src/components/EmailDraftCard.tsx');
const {emailDownloadFile}=require('../src/services/emailDownload.ts');
const fileFor=draft=>withResultActions({emailDraft:draft,sessionDetails:{aiMessageId:99,chatLock:false}},{downloadOnly:true}).actionButtons.buttons.find(a=>a.action==='email.download').payload.file;
const {decodeChatEnvelope,backendActions}=require('../src/services/chatEnvelope.ts');
const {PresentationViewer}=require('../src/components/PresentationViewer.tsx');
// Exercise the actual message renderer without importing the entire app shell.
const chatSource=ts.createSourceFile('WeaveAiChat.tsx',fs.readFileSync(path.join(__dirname,'../src/components/WeaveAiChat.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let rendererSource;
const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(chatSource)==='SmartMarkdownRenderer')rendererSource=node.initializer.getText(chatSource);ts.forEachChild(node,visit);};visit(chatSource);
const rendererJs=ts.transpileModule('const renderer='+rendererSource,{compilerOptions:{target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText;
const SmartMarkdownRenderer=new Function('React','EmailDraftCard','normalizeMessageText',rendererJs+';return renderer;')(React,EmailDraftCard,String);
const historyWorkflow=JSON.parse(fs.readFileSync(path.join(__dirname,'test-support/history.json')));
const historyCode=historyWorkflow.nodes.find(node=>node.name==='Code3').parameters.jsCode;
const fixtures=[];
(async()=>{
 for(const [language,subject,body]of [['en','Budget update 📩','Dear team,\n\nPlease send the report.\nThanks.'],['ar','طلب اعتماد الميزانية '.repeat(8).trim(),'السادة الزملاء،\n\nيرجى إرسال التقرير غداً.\nمع الشكر.']]){
  await i18n.changeLanguage(language);
  const raw={output:'Email ready',emailDraft:{subject,body,emailText:(language==='ar'?'الموضوع: ':'Subject: ')+subject+'\n\n'+body},sessionDetails:{aiMessageId:42,chatLock:false}};
  const envelope=withResultActions(raw,{from:'qa@example.invalid',downloadOnly:true}),decoded=decodeChatEnvelope(envelope),draft=decoded.emailDraft;
  const download=decoded.actionButtons.buttons.find(a=>a.action==='email.download');
  const eml=Buffer.from(download.payload.file.base64,'base64').toString('ascii');
  fixtures.push({eml,subject,body,from:'qa@example.invalid'});
  assert.ok(!/(^|[^\r])\n/.test(eml),'All file line breaks must be CRLF');
  assert.ok(eml.split('\r\n\r\n')[1].split('\r\n').every(line=>line.length<=76));
  const label=decoded.actionButtons.buttons.find(a=>a.action==='email.download').label;
  const card=(actions,selected=draft)=>React.createElement(I18nextProvider,{i18n},React.createElement(EmailDraftCard,{draft:selected,actions}));
  let view=render(card([]));assert.ok(!screen.queryByRole('button',{name:label}));
  view.rerender(card([{id:'wrong',action:'email.download',actionButtonType:'download',label,payload:{emailId:'other'}}]));assert.ok(!screen.queryByRole('button',{name:label}));
  view.rerender(card(decoded.actionButtons.buttons));fireEvent.click(screen.getByRole('button',{name:label}));
  assert.equal(lastBlob.type,'message/rfc822');assert.ok(downloads.at(-1).endsWith('.eml'));
  const clicked=await lastBlob.text();assert.equal(clicked,eml,'Browser must download exact backend file bytes');fixtures.push({eml:clicked,subject,body,from:'qa@example.invalid'});
  const editedSubject=(language==='ar'?'تحديث: ':'Updated: ')+subject;
  const editedBody=(language==='ar'?'هذا هو النص المعدل.\n':'This is the revised text.\n')+body;
  const edited=decodeChatEnvelope(withResultActions({...raw,emailDraft:{subject:editedSubject,body:editedBody,emailText:editedSubject+'\n\n'+editedBody},sessionDetails:{aiMessageId:43,chatLock:false}},{from:'qa@example.invalid',downloadOnly:true}));
  view.rerender(card(decoded.actionButtons.buttons,edited.emailDraft));assert.ok(!screen.queryByRole('button',{name:label}),'Old result actions must not download a new draft');
  view.rerender(card(edited.actionButtons.buttons,edited.emailDraft));fireEvent.click(screen.getByRole('button',{name:label}));
  fixtures.push({eml:await lastBlob.text(),subject:editedSubject,body:editedBody,from:'qa@example.invalid'});
  const oldCreate=URL.createObjectURL;URL.createObjectURL=()=>{throw Error('fixture download failure');};
  fireEvent.click(screen.getByRole('button',{name:label}));await screen.findByRole('alert');URL.createObjectURL=oldCreate;
  cleanup();
  const escape=text=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const markup='<section data-mof-email="1" data-subject="'+escape(subject)+'"><pre>'+escape(raw.emailDraft.emailText)+'</pre></section>';
  const items=[{json:{id:52,chat_session_id:42,user_message:false,message:markup}},{json:{id:53,chat_session_id:42,user_message:true,message:markup}}];
  const history=new Function('items','$',historyCode)(items,()=>({first:()=>({json:{user:{email:'qa@example.invalid'}}})}))[0].json;
  const row=history.data[0],restored=decodeChatEnvelope(row.responsePayload);
  assert.equal(restored.emailDraft?.body,body,'History action-only payload must restore the typed email');
  assert.equal(restored.sessionDetails,undefined,'Do not manufacture session metadata for history');
  assert.ok(!history.data[1].responsePayload,'User messages never acquire email actions');
  const historyView=render(React.createElement(I18nextProvider,{i18n},React.createElement(SmartMarkdownRenderer,{content:row.message,emailDraft:restored.emailDraft,actions:restored.actionButtons.buttons,components:{},imageComponents:{}})));
  assert.ok(!historyView.container.querySelector('pre'),'Restored email must use the card, not a scrolling code block');
  assert.ok(historyView.container.querySelector('.whitespace-pre-wrap'),'Email body must wrap while preserving line breaks');
  fireEvent.click(screen.getByRole('button',{name:label}));
  fixtures.push({eml:await lastBlob.text(),subject,body,from:'qa@example.invalid'});
  cleanup();
 }
 if(process.argv[3])for(const fixture of JSON.parse(fs.readFileSync(process.argv[3])).cases){
  const decoded=decodeChatEnvelope(fixture.response),action=decoded.actionButtons.buttons.find(a=>a.action==='email.download');
  if(!action){assert.equal(fixture.caseId,'greeting');continue;}
  const draft=decoded.emailDraft;
  render(React.createElement(I18nextProvider,{i18n},React.createElement(EmailDraftCard,{draft,actions:decoded.actionButtons.buttons})));
  fireEvent.click(screen.getByRole('button',{name:action.label}));
  assert.equal(Buffer.from(await lastBlob.arrayBuffer()).toString('base64'),action.payload.file.base64,'Download must match hosted n8n file byte-for-byte');
  assert.equal(downloads.at(-1),action.payload.file.filename);
  fixtures.push({eml:await lastBlob.text(),subject:draft.subject,body:draft.body,from:'qa@example.invalid'});
  cleanup();
 }
 const injectedFile=fileFor({subject:'Safe\r\nBcc: attacker@example.invalid',body:'Body',emailText:'Body',from:'bad\r\nBcc: attack@example.invalid'});
 const injected=Buffer.from(injectedFile.base64,'base64').toString('ascii');
 fixtures.push({eml:injected,subject:'Safe Bcc: attacker@example.invalid',body:'Body',from:null});
 assert.ok(!fileFor({subject:'../evil\\x\r\n.exe',body:'Body'}).filename.includes('/'));
 for(const file of [{...injectedFile,base64:'not base64!'},{...injectedFile,filename:'../bad.eml'},{...injectedFile,mimetype:'text/html'}])assert.throws(()=>emailDownloadFile({action:'email.download',actionButtonType:'download',label:'Download',payload:{emailId:'x',file}},'x'));
 execFileSync('python3',['-c',`import json,sys\nfrom email.parser import BytesParser\nfrom email import policy\nfor fixture in json.load(sys.stdin):\n m=BytesParser(policy=policy.default).parsebytes(fixture['eml'].encode('ascii'))\n assert str(m['Subject'])==fixture['subject'],(str(m['Subject']),fixture['subject'])\n assert m.get_content_type()=='text/plain'\n assert m.get_content_charset()=='utf-8'\n assert m.get_content().replace('\\r\\n','\\n')==fixture['body'].replace('\\r\\n','\\n')\n assert m['X-Unsent']=='1'\n assert m['Bcc'] is None\n assert str(m['From'])==fixture['from'] if fixture['from'] else m['From'] is None\n assert not m.defects\nprint('PASS: independent Python email parser validates generated/downloaded English/Arabic EML subjects, full bodies, MIME and header injection protection.')`],{input:JSON.stringify(fixtures),stdio:['pipe','inherit','inherit']});
 // Exercise the captured asynchronous generator response, not only the shared
 // action helper: this path previously delivered an empty button list.
 const generatedWorkflow=JSON.parse(fs.readFileSync(process.env.MOF_PPT_GENERATION_WORKFLOW||path.join(__dirname,'test-support/presentation-result.json')));
 const generatedCode=generatedWorkflow.nodes.find(node=>node.name==='Deck Result').parameters.jsCode;
 const generatedInputs={'Validate Generate Request':{session:{sessionId:'qa-generated-deck',socketId:'qa-socket',clientMessageId:'qa-message',weaveChatid:42}},'Assemble Deck':{spec:JSON.stringify(savedSpec),html,failed:[],warnings:[]}};
 const generated=new Function('$','$input',generatedCode)(name=>({first:()=>({json:generatedInputs[name]})}),{first:()=>({json:{deck_id:deckId}})})[0].json;
 const {SocketService}=require('../src/services/socketService.ts');
 const incoming=SocketService.prototype.normalizeIncomingMessage.call({sessionId:'qa-generated-deck'},{payload:generated.envelope});
 const decodedPresentation=decodeChatEnvelope(incoming);
 const presentation=decodedPresentation.presentation;
 const actions=decodedPresentation.actionButtons.buttons;
 assert.ok(actions.some(action=>action.action==='presentation.edit'),'Actual asynchronous generation must authorize the editor');
 assert.equal(actions.filter(action=>action.action==='presentation.export').length,2,'Actual asynchronous generation must authorize both export formats');
 const viewer=value=>React.createElement(PresentationViewer,{presentation,html,actions:value,onClose:()=>{},userId:'qa@example.invalid'});
 let view=render(viewer([]));assert.ok(!screen.queryByTitle('Download PDF'));assert.ok(!screen.queryByLabelText('Deck palette'));
 view.rerender(viewer(actions.map(action=>({...action,payload:{...action.payload,deckId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}}))));assert.ok(!screen.queryByTitle('Download PDF'));assert.ok(!screen.queryByLabelText('Deck palette'));
 view.rerender(viewer(actions));await screen.findByLabelText('Deck palette');await waitFor(()=>assert.ok(!screen.getByTitle('Download PDF').disabled));const pdf=screen.getByTitle('Download PDF'),pptx=screen.getByTitle('Download PowerPoint');
 fireEvent.click(pdf);await waitFor(()=>assert.equal(exportCalls.length,1));await waitFor(()=>assert.ok(!pdf.disabled));
 fireEvent.click(pptx);await waitFor(()=>assert.equal(exportCalls.length,2));await waitFor(()=>assert.ok(!pdf.disabled));
 fireEvent.change(screen.getByLabelText('Deck palette'),{target:{value:'sapphire'}});
 assert.ok(pdf.disabled,'Unsaved changes must be saved before exporting');
 const save=screen.getAllByRole('button',{name:'Save',exact:true}).find(button=>!button.disabled);assert.ok(save);fireEvent.click(save);
 await waitFor(()=>assert.equal(savedSpec.theme.id,'sapphire'));await waitFor(()=>assert.ok(!pdf.disabled));
 fireEvent.change(screen.getByRole('textbox',{name:'Title',exact:true}),{target:{value:'Updated slide heading'}});
 fireEvent.change(screen.getByRole('textbox',{name:'Body',exact:true}),{target:{value:'Updated slide text / نص الشريحة المعدل'}});
 assert.ok(pdf.disabled,'Text edits must be saved before exporting');
 fireEvent.click(screen.getAllByRole('button',{name:'Save',exact:true}).find(button=>!button.disabled));
 await waitFor(()=>assert.equal(savedSpec.slides[0].content.title,'Updated slide heading'));
 assert.equal(savedSpec.slides[0].content.body,'Updated slide text / نص الشريحة المعدل');
 await waitFor(()=>assert.ok(!pdf.disabled));
 assert.deepEqual(exportCalls.map(e=>e.format),['pdf','pptx']);
 cleanup();dom.window.close();
 console.log('PASS: backend-gated email card downloads, mismatch/error states; Presentation PDF/PPTX controls, slide text/colour edits and saves, cross-deck/missing-action suppression.');
})().catch(error=>{cleanup();console.error(error);process.exitCode=1;});
