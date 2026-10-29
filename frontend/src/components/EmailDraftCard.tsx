import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownTrayIcon, ClipboardDocumentIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { copyText } from '../utils/copyText';
import { detectTextDirection } from '../utils/textDirection';
import type { EmailDraft } from '../services/emailDraft';
import { type ChatAction } from '../services/chatEnvelope';
import { downloadEmailDraft } from '../services/emailDownload';

export function EmailDraftCard({ draft, actions }: { draft: EmailDraft; actions?: ChatAction[] }) {
  const { t } = useTranslation();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [downloadFailed,setDownloadFailed]=useState(false);
  const copyAction = draft.id&&actions?.find(action => action.action === 'email.copy' && action.payload?.emailId === draft.id);
  const downloadAction = draft.id&&actions?.find(action => action.action === 'email.download' && action.actionButtonType==='download' && action.payload?.emailId === draft.id && typeof action.payload?.file?.base64 === 'string' && action.payload.file.base64.length > 0);
  const copyEmail = async () => {
    setCopyState(await copyText(draft.emailText) ? 'copied' : 'failed');
  };
  return (
    <section className="not-prose overflow-hidden rounded-xl border border-[#E8DEC8] bg-white" dir={detectTextDirection(draft.emailText)} aria-label={t('emailDraft.title')}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAECF0] bg-[#FFFCF5] px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-[#80652E]"><EnvelopeIcon className="h-4 w-4" />{t('emailDraft.title')}</span>
        <div className="flex flex-wrap items-center gap-2">
        {copyAction && <button type="button" onClick={copyEmail} className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-medium text-[#344054] hover:bg-[#F9FAFB]" aria-label={copyAction.label}>
          <ClipboardDocumentIcon className="h-4 w-4" />{copyState === 'copied' ? t('emailDraft.copied') : copyAction.label}
        </button>}
        {downloadAction&&<button type="button" onClick={()=>{try{downloadEmailDraft(downloadAction,draft.id!);setDownloadFailed(false);}catch{setDownloadFailed(true);}}} className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-medium text-[#344054] hover:bg-[#F9FAFB]" aria-label={downloadAction.label}>
          <ArrowDownTrayIcon className="h-4 w-4" />{downloadAction.label}
        </button>}
        </div>
      </div>
      <div className="border-b border-[#EAECF0] px-4 py-3 text-sm"><span className="text-[#667085]">{t('emailDraft.subject')}: </span><span className="font-semibold text-[#101828]">{draft.subject}</span></div>
      <div className="whitespace-pre-wrap break-words px-4 py-5 text-sm leading-relaxed text-[#344054]">{draft.body}</div>
      <span role="status" aria-live="polite" className={copyState === 'failed' ? 'block px-4 pb-3 text-xs text-red-700' : 'sr-only'}>{copyState === 'failed' ? t('emailDraft.copyFailed') : copyState === 'copied' ? t('emailDraft.copied') : ''}</span>
      {downloadFailed&&<p role="alert" className="px-4 pb-3 text-xs text-red-700">{t('emailDraft.downloadFailed')}</p>}
    </section>
  );
}
