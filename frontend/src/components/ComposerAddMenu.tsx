import React, { useEffect, useRef, useState } from 'react';
import { BookmarkIcon, PaperClipIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

export function ComposerAddMenu({disabled,canAttach,onAttachment,onSavedPrompts}:{disabled:boolean;canAttach:boolean;onAttachment:()=>void;onSavedPrompts:()=>void}) {
  const {t}=useTranslation();const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),first=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;first.current?.focus();
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus();}
      if(event.key==='Tab')setOpen(false);
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();const items=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')||[]);
        const index=items.indexOf(document.activeElement as HTMLButtonElement);
        const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowUp'?-1:1)+items.length)%items.length;
        items[next]?.focus();
      }
    };
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};
  },[open]);
  return <div ref={root} className="relative flex-shrink-0">
    <button ref={trigger} type="button" aria-label={t('savedPrompts.add')} title={t('savedPrompts.add')} aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={()=>setOpen(value=>!value)} className="rounded-full p-1.5 text-[#98A2B3] transition-colors hover:text-[#C6A75D] disabled:opacity-40"><PlusIcon className="h-6 w-6" strokeWidth={1.8} /></button>
    {open&&<div role="menu" className="absolute bottom-full start-0 z-30 mb-2 min-w-[210px] rounded-xl border border-[#E8DEC8] bg-white p-1 shadow-lg">
      {canAttach&&<button ref={first} role="menuitem" type="button" onClick={()=>{setOpen(false);onAttachment();}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm text-[#344054] hover:bg-[#FFFCF5]"><PaperClipIcon className="h-4 w-4" />{t('savedPrompts.attachment')}</button>}
      <button ref={canAttach?undefined:first} role="menuitem" type="button" onClick={()=>{setOpen(false);onSavedPrompts();}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm text-[#344054] hover:bg-[#FFFCF5]"><BookmarkIcon className="h-4 w-4" />{t('savedPrompts.title')}</button>
    </div>}
  </div>;
}
