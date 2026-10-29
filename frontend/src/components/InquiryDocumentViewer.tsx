import React, { useEffect, useState } from 'react';
import { ArrowsPointingOutIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  InquiryDocumentLoadError,
  InquiryDocumentRef,
  fetchInquiryDocument,
} from '../services/inquiryDocument';

export interface InquiryDocumentTarget extends InquiryDocumentRef {
  /** The document name shown on the reference card, used until the PDF arrives. */
  title?: string;
}

interface InquiryDocumentViewerProps {
  target: InquiryDocumentTarget;
  apiBaseUrl: string;
  isArabic: boolean;
  onClose: () => void;
}

const LABELS = {
  en: {
    title: 'Reference', page: 'Page', loading: 'Loading document', openTab: 'Open in new tab', close: 'Close',
    mobileOpen: 'Document not showing? Open the PDF',
    unauthorized: 'You do not have access to this document.',
    not_found: 'This document is no longer available, or you do not have access to it.',
    preview_not_ready: 'This document has no PDF preview yet, so it cannot be opened at a page.',
    failed: 'The document could not be loaded. Please try again.',
  },
  ar: {
    title: 'المرجع', page: 'الصفحة', loading: 'جاري تحميل المستند', openTab: 'فتح في علامة تبويب جديدة', close: 'إغلاق',
    mobileOpen: 'لا يظهر المستند؟ افتح ملف PDF',
    unauthorized: 'ليست لديك صلاحية الوصول إلى هذا المستند.',
    not_found: 'هذا المستند لم يعد متاحاً، أو ليست لديك صلاحية الوصول إليه.',
    preview_not_ready: 'لا تتوفر معاينة PDF لهذا المستند بعد، لذا لا يمكن فتحه على صفحة محددة.',
    failed: 'تعذر تحميل المستند. يرجى المحاولة مرة أخرى.',
  },
};

/** Shows the PDF behind a knowledge-base reference, opened at the cited page. */
export const InquiryDocumentViewer: React.FC<InquiryDocumentViewerProps> = ({ target, apiBaseUrl, isArabic, onClose }) => {
  const L = isArabic ? LABELS.ar : LABELS.en;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState<string | null>(null);

  // A new document loads afresh; the same document at another page only moves the viewer.
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setPdfUrl(null);
    setError(null);
    setFilename('');
    fetchInquiryDocument(apiBaseUrl, target, controller.signal)
      .then(({ blob, filename: name }) => {
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
        setFilename(name);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof InquiryDocumentLoadError ? L[reason.reason] : L.failed);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl, target.documentId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const name = target.title || filename || L.title;
  const pageUrl = pdfUrl ? `${pdfUrl}#page=${target.page}` : null;
  const openInTab = () => { if (pageUrl) window.open(pageUrl, '_blank', 'noopener,noreferrer'); };

  return (
    <aside
      className="inquiry-document-viewer fixed inset-0 z-50 flex flex-col bg-[#EEF0F2] lg:relative lg:inset-auto lg:z-auto lg:order-last lg:w-[min(760px,50vw)] lg:shrink-0 lg:border-s lg:border-[#D5D8DC] lg:shadow-[-8px_0_24px_rgba(16,24,40,0.06)]"
      dir={isArabic ? 'rtl' : 'ltr'}
      aria-label={L.title}
    >
      <div className="flex items-center gap-2 border-b border-[#D5D8DC] bg-white px-4 py-2.5">
        <div className="min-w-0 me-auto">
          <h2 className="truncate text-sm font-semibold text-[#101828]" dir="auto" title={name}>{name}</h2>
          <p className="truncate text-[11px] text-[#667085]" dir="auto">
            {L.page} {target.page}{target.heading ? ` · ${target.heading}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg p-1.5 text-[#667085] hover:bg-[#F2F4F7] disabled:opacity-40"
          title={L.openTab}
          aria-label={L.openTab}
          disabled={!pageUrl}
          onClick={openInTab}
        >
          <ArrowsPointingOutIcon className="h-4 w-4" />
        </button>
        <button type="button" className="rounded-lg p-1.5 text-[#667085] hover:bg-[#F2F4F7]" title={L.close} aria-label={L.close} onClick={onClose}>
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 p-3">
        {pageUrl ? (
          // Keyed by page so a click on another reference in the same document jumps to it.
          <iframe key={pageUrl} src={pageUrl} title={name} className="h-full w-full border border-[#D5D8DC] bg-white shadow-sm" />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-xs text-[#667085]" role="status">
            {error || `${L.loading}…`}
          </div>
        )}
      </div>
      {/* Phone browsers often cannot show a PDF inside the page. */}
      {pageUrl && (
        <button type="button" onClick={openInTab} className="mx-3 mb-3 rounded-md border border-[#C6A75D] bg-white px-3 py-2 text-xs font-medium text-[#8A6D2F] lg:hidden">
          {L.mobileOpen}
        </button>
      )}
    </aside>
  );
};
