import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookmarkIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { requestSavedPrompts, type SavedPrompt, type PromptCursor } from '../services/savedPrompts';
import { type ChatAction } from '../services/chatEnvelope';

interface Props {
  baseUrl:string;ownerKey:string;open:boolean;saveText:string|null;
  onClose:()=>void;onUse:(content:string)=>void;onActions:(actions:ChatAction[])=>void;
}
export function SavedPromptsPanel({baseUrl,ownerKey,open,saveText,onClose,onUse,onActions}:Props) {
  const {t,i18n}=useTranslation();
  const language=i18n.language?.startsWith('ar')?'ar':'en';
  const [prompts,setPrompts]=useState<SavedPrompt[]>([]);
  const [actions,setActions]=useState<ChatAction[]>([]);
  const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [title,setTitle]=useState(''),[content,setContent]=useState('');
  const [search,setSearch]=useState(''),[confirmDelete,setConfirmDelete]=useState<string|null>(null);
  const searchRef=useRef(search);searchRef.current=search;
  const epoch=useRef(0),requestNumber=useRef(0),busyRef=useRef(false);
  const previousOwner=useRef(ownerKey);
  const aborts=useRef(new Set<AbortController>());
  const dialog=useRef<HTMLDivElement>(null);
  const firstInput=useRef<HTMLInputElement>(null);
  const controller=()=>{const value=new AbortController();aborts.current.add(value);return value;};
  const load=useCallback(async(cursor?:PromptCursor,query=searchRef.current)=>{
    const version=epoch.current,number=++requestNumber.current,c=controller();
    setLoading(true);setError('');
    try {
      const response=await requestSavedPrompts(baseUrl,{action:'list',language,search:query,...(cursor?{cursor}:{})},c.signal);
      if(version!==epoch.current||number!==requestNumber.current)return;
      setPrompts(previous=>cursor?[...previous,...(response.prompts||[])].filter((p,i,all)=>all.findIndex(x=>x.id===p.id)===i):(response.prompts||[]));
      setActions(response.actionButtons.buttons);onActions(response.actionButtons.buttons);
    } catch(e) {if(version===epoch.current&&number===requestNumber.current&&!c.signal.aborted){setError('savedPrompts.loadFailed');setActions([]);onActions([]);}}
    finally{aborts.current.delete(c);if(version===epoch.current&&number===requestNumber.current)setLoading(false);}
  },[baseUrl,language,onActions]);
  useEffect(()=>{
    epoch.current++;busyRef.current=false;setBusy(false);setPrompts([]);setActions([]);onActions([]);setNotice('');setSearch('');setConfirmDelete(null);
    void load(undefined,'');
    return ()=>{epoch.current++;for(const c of aborts.current)c.abort();aborts.current.clear();};
  },[baseUrl,ownerKey,load,onActions]);
  useEffect(()=>{if(previousOwner.current!==ownerKey){previousOwner.current=ownerKey;onClose();}},[ownerKey,onClose]);
  useEffect(()=>{
    if(!open||saveText!==null)return;
    const timeout=setTimeout(()=>void load(undefined,search),200);
    return()=>clearTimeout(timeout);
  },[open,saveText,search,load]);
  useEffect(()=>{if(saveText!==null){setContent(saveText);setTitle(saveText.split('\n').find(line=>line.trim())?.trim().slice(0,120)||'');setError('');}},[saveText]);
  useEffect(()=>{if(!notice)return;const timeout=setTimeout(()=>setNotice(''),2500);return()=>clearTimeout(timeout);},[notice]);
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement as HTMLElement|null;
    firstInput.current?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!busyRef.current){event.preventDefault();onClose();}
      if(event.key==='Tab'){
        const nodes=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,textarea,[tabindex="0"]')||[]);
        const first=nodes[0],last=nodes[nodes.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('keydown',key);previous?.focus?.();};
  },[open,saveText,onClose]);
  const saveAction=actions.find(action=>action.action==='prompt.save');
  const moreAction=actions.find(action=>action.action==='prompt.more');
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();if(busyRef.current||!saveAction)return;
    const value=content.trim(),name=title.trim();
    if(!name||name.length>120||!value||value.length>12000){setError('savedPrompts.invalid');return;}
    busyRef.current=true;requestNumber.current++;setLoading(false);setBusy(true);setError('');
    const version=epoch.current,c=controller();
    try{
      const response=await requestSavedPrompts(baseUrl,{action:'save',language,title:name,content:value},c.signal);
      if(version!==epoch.current)return;
      if(!response.prompt)throw Error('Missing saved prompt');
      setPrompts(previous=>[response.prompt!,...previous.filter(p=>p.id!==response.prompt!.id)]);
      setNotice(t('savedPrompts.saved'));onClose();
    }catch(e){if(version===epoch.current&&!c.signal.aborted)setError('savedPrompts.saveFailed');}
    finally{aborts.current.delete(c);if(version===epoch.current){busyRef.current=false;setBusy(false);}}
  };
  const remove=async(prompt:SavedPrompt)=>{
    if(busyRef.current||!prompt.actionButtons.buttons.some(action=>action.action==='prompt.delete'&&action.payload?.id===prompt.id))return;
    busyRef.current=true;requestNumber.current++;setLoading(false);setBusy(true);setError('');const version=epoch.current,c=controller();
    try{
      await requestSavedPrompts(baseUrl,{action:'delete',language,id:prompt.id},c.signal);
      if(version!==epoch.current)return;
      setPrompts(previous=>previous.filter(p=>p.id!==prompt.id));setConfirmDelete(null);
    }catch(e){if(version===epoch.current&&!c.signal.aborted)setError('savedPrompts.deleteFailed');}
    finally{aborts.current.delete(c);if(version===epoch.current){busyRef.current=false;setBusy(false);}}
  };
  const use=(prompt:SavedPrompt)=>{
    if(busy||!prompt.actionButtons.buttons.some(action=>action.action==='prompt.use'&&action.payload?.id===prompt.id))return;
    try{onUse(prompt.content);onClose();}catch{setError('savedPrompts.tooLong');}
  };
  const filtered=prompts;
  return <>
    {notice&&<div role="status" className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-[#344054] px-4 py-3 text-sm text-white">{notice}</div>}
    {open&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-3" onMouseDown={event=>{if(event.target===event.currentTarget&&!busyRef.current)onClose();}}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="saved-prompts-heading" dir={language==='ar'?'rtl':'ltr'} className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#E8DEC8] bg-white shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[#EAECF0] p-4">
          <h2 id="saved-prompts-heading" className="flex items-center gap-2 font-semibold text-[#344054]"><BookmarkIcon className="h-5 w-5 text-[#9F7D32]" />{t(saveText!==null?'savedPrompts.saveTitle':'savedPrompts.title')}</h2>
          <button type="button" disabled={busy} onClick={onClose} aria-label={t('savedPrompts.close')} className="rounded-lg p-1.5 hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </header>
        <div className="overflow-y-auto p-4">
          {saveText!==null?<form onSubmit={save} className="space-y-4">
            <label className="block text-sm text-[#344054]">{t('savedPrompts.name')}<input ref={firstInput} value={title} onChange={event=>setTitle(event.target.value)} maxLength={120} required disabled={busy} dir="auto" className="mt-1 w-full rounded-lg border border-[#D0D5DD] px-3 py-2" /></label>
            <label className="block text-sm text-[#344054]">{t('savedPrompts.text')}<textarea value={content} onChange={event=>setContent(event.target.value)} required disabled={busy} dir="auto" rows={8} className="mt-1 w-full rounded-lg border border-[#D0D5DD] px-3 py-2" /></label>
            <p className="text-xs text-[#667085]">{t('savedPrompts.private')}</p>
            <button type="submit" disabled={busy||!saveAction||!title.trim()||!content.trim()||content.trim().length>12000} className="rounded-lg bg-[#9F7D32] px-4 py-2 text-sm text-white disabled:opacity-40">{busy?t('savedPrompts.saving'):saveAction?.label||t('savedPrompts.saveTitle')}</button>
          </form>:<>
            <input ref={firstInput} value={search} maxLength={120} onChange={event=>setSearch(event.target.value)} aria-label={t('savedPrompts.search')} placeholder={t('savedPrompts.search')} className="mb-3 w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm" />
            {!loading&&!error&&!filtered.length&&<p className="py-6 text-center text-sm text-[#667085]">{t(search?'savedPrompts.noMatches':'savedPrompts.empty')}</p>}
            <ul className="space-y-2">{filtered.map(prompt=>{
              const useAction=prompt.actionButtons.buttons.find(a=>a.action==='prompt.use'&&a.payload?.id===prompt.id);
              const deleteAction=prompt.actionButtons.buttons.find(a=>a.action==='prompt.delete'&&a.payload?.id===prompt.id);
              return <li key={prompt.id} className="rounded-xl border border-[#EAECF0] p-3">
                <div className="flex items-start gap-2">
                  <button type="button" onClick={()=>use(prompt)} disabled={busy||!useAction} className="min-w-0 flex-1 text-start disabled:opacity-50" aria-label={useAction?`${useAction.label}: ${prompt.title}`:prompt.title}>
                    <p className="break-words text-sm font-medium text-[#344054]" dir="auto">{prompt.title}</p><p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-[#667085]" dir="auto">{prompt.content}</p>
                  </button>
                  {deleteAction&&<button type="button" disabled={busy} aria-label={`${deleteAction.label}: ${prompt.title}`} onClick={()=>setConfirmDelete(prompt.id)} className="rounded-lg p-1.5 text-[#667085] hover:bg-red-50 hover:text-red-700"><TrashIcon className="h-4 w-4" /></button>}
                </div>
                {confirmDelete===prompt.id&&<div className="mt-3 flex flex-wrap items-center gap-3 text-xs"><span>{t('savedPrompts.deleteConfirm')}</span><button type="button" disabled={busy} onClick={()=>void remove(prompt)} className="text-red-700">{deleteAction?.label}</button><button type="button" disabled={busy} onClick={()=>setConfirmDelete(null)}>{t('savedPrompts.cancel')}</button></div>}
              </li>;
            })}</ul>
            {moreAction&&<button type="button" disabled={loading||busy} onClick={()=>void load(moreAction.payload?.cursor)} className="mt-3 rounded-lg border px-3 py-2 text-sm">{moreAction.label}</button>}
            {loading&&<p role="status" className="mt-3 text-sm text-[#667085]">{t('savedPrompts.loading')}</p>}
            <p className="mt-3 text-xs text-[#667085]">{t('savedPrompts.reuseHelp')}</p>
          </>}
          {error&&<div role="alert" className="mt-3 text-sm text-red-700">{t(error)}{!busy&&<button type="button" onClick={()=>void load()} className="ms-2 underline">{t('savedPrompts.retry')}</button>}</div>}
        </div>
      </div>
    </div>}
  </>;
}
