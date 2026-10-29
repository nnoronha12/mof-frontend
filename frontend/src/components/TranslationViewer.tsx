import { hasBackendAction, type ChatAction } from '../services/chatEnvelope';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import {
  ArrowDownTrayIcon,
  ArrowsPointingOutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { TranslationResult, translationPageImageUrl } from '../services/translationWorkflow';

interface TranslationViewerProps {
  result: TranslationResult;
  actions?: ChatAction[];
  isArabic: boolean;
  onClose: () => void;
}

interface PageSummary {
  page: number;
  label: string;
  needsReview: boolean;
}

const LABELS = {
  en: {
    title: 'Translated document', pages: 'pages',
    pdf: 'PDF', html: 'HTML', openTab: 'Open in new tab', collapse: 'Collapse',
    expand: 'Expand translation', close: 'Close', pageList: 'Pages', page: 'Page', review: 'Needs review',
    reviewNote: 'These pages did not pass every automatic check. Compare them with the original.',
    showOriginal: 'Original page', loading: 'Loading', preparing: 'Preparing', saved: 'Downloaded',
    failed: 'Could not load', original: 'Original page', ar: 'Arabic', en: 'English',
  },
  ar: {
    title: 'المستند المترجم', pages: 'عدد الصفحات',
    pdf: 'PDF', html: 'HTML', openTab: 'فتح في علامة تبويب جديدة', collapse: 'طي',
    expand: 'عرض الترجمة', close: 'إغلاق', pageList: 'الصفحات', page: 'صفحة', review: 'تحتاج إلى مراجعة',
    reviewNote: 'لم تجتز هذه الصفحات جميع الفحوصات الآلية. قارنها بالأصل.',
    showOriginal: 'الصفحة الأصلية', loading: 'جاري التحميل', preparing: 'جاري التجهيز', saved: 'تم التنزيل',
    failed: 'تعذر التحميل', original: 'الصفحة الأصلية', ar: 'العربية', en: 'الإنجليزية',
  },
};

const sanitize = (html: string) =>
  DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['style'],
    ADD_ATTR: ['style'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['action', 'formaction', 'sandbox'],
  });

const summarizePages = (html: string, review: Set<number>): PageSummary[] => {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll<HTMLElement>('section.tr-page')).map((section, index) => {
    const page = Number(section.dataset.page) || index + 1;
    const heading = section.querySelector('h1, h2, h3, h4')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    return {
      page,
      label: heading.length > 46 ? `${heading.slice(0, 46).trim()}…` : heading,
      needsReview: review.has(page) || section.dataset.status === 'needs_review',
    };
  });
};

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

export const TranslationViewer: React.FC<TranslationViewerProps> = ({ result, isArabic, onClose, actions }) => {
  const L = isArabic ? LABELS.ar : LABELS.en;
  const [doc, setDoc] = useState<string>(result.html || '');
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState<number | null>(null);
  const [originalPage, setOriginalPage] = useState<number | null>(null);
  const [width, setWidth] = useState(960);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const resizingRef = useRef(false);

  const review = useMemo(() => new Set(result.needsReview || []), [result.needsReview]);
  const html = doc;
  const pages = useMemo(() => summarizePages(html, review), [html, review]);
  const safeHtml = useMemo(() => (html ? sanitize(html) : ''), [html]);
  const languages = result.sourceLang && result.targetLang
    ? `${L[result.sourceLang as 'ar' | 'en'] ?? result.sourceLang} → ${L[result.targetLang as 'ar' | 'en'] ?? result.targetLang}`
    : '';

  // A new job replaces the panel's content.
  useEffect(() => {
    setDoc(result.html || '');
    setCurrentPage(null);
    setStatus('');
  }, [result.jobId, result.html]);

  // Large documents are not sent through the WebSocket: load the HTML from the view link.
  useEffect(() => {
    if (doc) return;
    let cancelled = false;
    setBusy(L.loading);
    fetch(result.links.view)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (!cancelled) setDoc(text);
      })
      .catch((error) => { if (!cancelled) setStatus(`${L.failed}: ${error instanceof Error ? error.message : String(error)}`); })
      .finally(() => { if (!cancelled) setBusy(null); });
    return () => { cancelled = true; };
  }, [doc, result.links.view, L.loading, L.failed]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!resizingRef.current) return;
      // The panel sits at the inline end: the right edge in English, the left edge in Arabic.
      const next = isArabic ? event.clientX : window.innerWidth - event.clientX;
      setWidth(Math.max(640, Math.min(1400, next)));
    };
    const stop = () => { resizingRef.current = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
  }, [isArabic]);

  const scrollToPage = useCallback((page: number) => {
    setCurrentPage(page);
    const doc = frameRef.current?.contentDocument;
    doc?.getElementById(`p-${page}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  // Follow the reader: the document scrolls inside its own <main class="deck">.
  const handleFrameLoad = () => {
    const doc = frameRef.current?.contentDocument;
    const scroller = doc?.querySelector('main.deck');
    if (!doc || !scroller) return;
    scroller.addEventListener('scroll', () => {
      const sections = Array.from(doc.querySelectorAll<HTMLElement>('section.tr-page'));
      const top = scroller.getBoundingClientRect().top;
      const visible = sections.find((section) => section.getBoundingClientRect().bottom > top + 80);
      if (visible) setCurrentPage(Number(visible.dataset.page) || null);
    }, { passive: true });
  };

  const download = async (url: string, filename: string, label: string) => {
    setBusy(`${L.preparing} ${label}`);
    setStatus('');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      saveBlob(await response.blob(), filename);
      setStatus(`${L.saved}: ${filename}`);
    } catch (error) {
      setStatus(`${L.failed} ${label}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const stem = `translation-${(result.targetLang || '').toUpperCase() || 'doc'}`;
  const openInTab = () => {
    if (!safeHtml) return;
    const url = URL.createObjectURL(new Blob([safeHtml], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  if (collapsed) {
    return (
      <aside className="translation-viewer order-last hidden w-12 shrink-0 border-s border-[#D5D8DC] bg-[#EEF0F2] lg:flex">
        <button type="button" className="flex h-full w-12 items-center justify-center text-[#667085] hover:bg-white" onClick={() => setCollapsed(false)} aria-label={L.expand} title={L.expand}>
          {isArabic ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />}
        </button>
      </aside>
    );
  }

  const pdfAction = actions?.find(a => a.action === 'translation.download' && a.payload?.jobId === result.jobId && a.payload?.format === 'pdf');
  const reviewPages = pages.filter((p) => p.needsReview).map((p) => p.page);

  return (
    <aside
      className="translation-viewer relative order-last hidden shrink-0 border-s border-[#D5D8DC] bg-[#EEF0F2] shadow-[-8px_0_24px_rgba(16,24,40,0.06)] lg:grid grid-cols-[200px_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)]"
      style={{ width }}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div
        role="separator"
        aria-label="Resize translation panel"
        className="absolute z-20 h-full w-1 cursor-col-resize transition-colors hover:bg-[#C6A75D]"
        style={{ marginInlineStart: '-2px' }}
        onPointerDown={(event) => { event.preventDefault(); resizingRef.current = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
      />

      {/* header */}
      <div className="col-span-2 row-start-1 flex flex-wrap items-center gap-2 border-b border-[#D5D8DC] bg-white px-4 py-2.5">
        <div className="min-w-0 me-auto">
          <h2 className="text-sm font-semibold text-[#101828]">{L.title}</h2>
          <p className="text-[11px] text-[#667085]">
            {isArabic ? `${L.pages}: ${result.pages ?? pages.length}` : `${result.pages ?? pages.length} ${L.pages}`}{languages ? ` · ${languages}` : ''}
          </p>
        </div>
        {pdfAction && <button type="button" disabled={!!busy} onClick={() => void download(result.links.pdf, `${stem}.pdf`, L.pdf)}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#92722A] bg-[#92722A] px-3 py-2 text-sm font-semibold text-white hover:bg-[#7C5E24] disabled:opacity-40">
          <ArrowDownTrayIcon className="h-3.5 w-3.5" />{pdfAction?.label}
        </button>}
        {hasBackendAction(actions, 'translation.openTab') && <button type="button" className="rounded-lg p-1.5 text-[#667085] hover:bg-[#F2F4F7]" title={L.openTab} aria-label={L.openTab} onClick={openInTab}><ArrowsPointingOutIcon className="h-4 w-4" /></button>}
        <button type="button" className="rounded-lg p-1.5 text-[#667085] hover:bg-[#F2F4F7]" title={L.collapse} aria-label={L.collapse} onClick={() => setCollapsed(true)}>
          {isArabic ? <ChevronLeftIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
        </button>
        <button type="button" className="rounded-lg p-1.5 text-[#667085] hover:bg-[#F2F4F7]" title={L.close} aria-label={L.close} onClick={onClose}><XMarkIcon className="h-5 w-5" /></button>
        {(busy || status) && (
          <p className="basis-full text-[11px] text-[#8A6D2F]" role="status">{busy ? `${busy}…` : status}</p>
        )}
      </div>

      {/* page list */}
      <nav className="col-start-1 row-start-2 flex min-h-0 flex-col gap-1 overflow-y-auto border-e border-[#D5D8DC] bg-[#F7F7F7] px-2 py-3" aria-label={L.pageList}>
        <h3 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-[#4B4F58]">{L.pageList}</h3>
        {reviewPages.length > 0 && (
          <div className="mx-1 mb-1 rounded-md border border-[#FDA29B] bg-[#FEF3F2] px-2 py-1.5 text-[11px] text-[#B42318]">
            <div className="flex items-center gap-1 font-semibold"><ExclamationTriangleIcon className="h-3.5 w-3.5" />{L.review}</div>
            <p className="mt-0.5 leading-snug">{L.reviewNote}</p>
          </div>
        )}
        {pages.map((p) => (
          <div key={p.page} className={`group flex items-start gap-1 rounded-md ${currentPage === p.page ? 'bg-white shadow-[inset_3px_0_0_#92722A]' : 'hover:bg-[#E4E6E9]'}`}>
            <button type="button" onClick={() => scrollToPage(p.page)} className="flex min-w-0 flex-1 items-start gap-2 px-2 py-1.5 text-start text-xs text-[#232528]">
              <span className="w-6 shrink-0 font-bold text-[#7C5E24]">{p.page}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate" dir="auto">{p.label || `${L.page} ${p.page}`}</span>
                {p.needsReview && <span className="text-[10px] font-semibold text-[#B42318]">{L.review}</span>}
              </span>
            </button>
            <button type="button" onClick={() => setOriginalPage(p.page)} title={L.showOriginal} aria-label={`${L.showOriginal} ${p.page}`}
              className="mt-1 me-1 rounded p-1 text-[#98A2B3] opacity-0 hover:bg-white hover:text-[#7C5E24] focus:opacity-100 group-hover:opacity-100">
              <PhotoIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </nav>

      {/* document */}
      <div className="col-start-2 row-start-2 min-h-0 min-w-0 p-3">
        {safeHtml ? (
          <iframe ref={frameRef} key={result.jobId} onLoad={handleFrameLoad} title={L.title}
            className="h-full w-full border border-[#D5D8DC] bg-white shadow-sm" sandbox="allow-same-origin" srcDoc={safeHtml} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[#667085]">{busy ? `${busy}…` : status}</div>
        )}
      </div>

      {originalPage !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOriginalPage(null)} role="dialog" aria-label={`${L.original} ${originalPage}`}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <b className="text-sm text-[#101828]">{L.original} {originalPage}</b>
              <button type="button" className="rounded-lg p-1.5 text-[#667085] hover:bg-[#F2F4F7]" onClick={() => setOriginalPage(null)} aria-label={L.close}><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <img src={translationPageImageUrl(result.links, originalPage)} alt={`${L.original} ${originalPage}`} className="mx-auto block max-w-full border border-[#D5D8DC]" />
          </div>
        </div>
      )}
    </aside>
  );
};
