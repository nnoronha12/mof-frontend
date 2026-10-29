import React, { useEffect, useRef, useState } from 'react';
import { BookmarkIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import type { ChatAction } from '../services/chatEnvelope';

export function PromptSaveMenu({action,onSave,align='start'}:{action:ChatAction;onSave:()=>void;align?:'start'|'end'}) {
  const {t}=useTranslation();
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const item=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;
    item.current?.focus();
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus();}if(event.key==='Tab')setOpen(false);};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
    return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};
  },[open]);
  return <div className="relative" ref={root}>
    <button ref={trigger} type="button" aria-label={t('savedPrompts.more')} aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(value=>!value)} className="rounded-md p-1.5 text-[#667085] hover:bg-[#F3E8CC]">
      <EllipsisHorizontalIcon className="h-5 w-5" />
    </button>
    {open&&<div role="menu" className={`absolute bottom-full ${align==='end'?'end-0':'start-0'} z-30 mb-2 min-w-[180px] rounded-xl border border-[#E8DEC8] bg-white p-1 shadow-lg`}>
      <button ref={item} role="menuitem" type="button" onClick={()=>{setOpen(false);onSave();}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm text-[#344054] hover:bg-[#FFFCF5]">
        <BookmarkIcon className="h-4 w-4" />{action.label}
      </button>
    </div>}
  </div>;
}
