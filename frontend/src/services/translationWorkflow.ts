/**
 * Contract of the n8n workflow "MOF Bi Directional Translation".
 *
 * With the unified envelope, chat result actions come exclusively from backend
 * actionButtons. Typed content is projected by chatEnvelope.ts for this viewer.
 * The legacy link parser below is not used to create frontend action buttons.
 *
 * The chat upload goes to the service's catalogue route. Progress and the result come
 * back over the WebSocket; the final envelope carries `translation` (below) and,
 * for documents up to about 1.5 MB, the translated HTML as `presentationHtml`.
 * The links use a per-job view key, so they work without the Token header.
 */
export interface TranslationLinks {
  /** Translated PDF. */
  pdf: string;
  /** Translated HTML as a download. */
  html: string;
  /** Translated HTML for viewing. */
  view: string;
}

export interface TranslationDescriptor {
  jobId: string;
  viewKey: string;
  status: 'done' | 'done_with_review' | 'failed' | string;
  sourceLang?: 'ar' | 'en' | string;
  targetLang?: 'ar' | 'en' | string;
  pages?: number;
  needsReview?: number[];
  links: TranslationLinks;
}

/** What the translation viewer needs: the descriptor and, when it was sent, the HTML. */
export interface TranslationResult extends TranslationDescriptor {
  html: string;
}


const TRANSLATION_LINK = /(https?:\/\/[^\s"'<>]+?)\/translate\/(?:export|document)\?jobId=([^&\s"'<>]+)&(?:amp;)?k=([^&\s"'<>]+)/;

/**
 * Rebuilds the descriptor from a saved chat message. Chat history keeps only the
 * message text, but the workflow's final message links to the job's PDF and HTML
 * with the job id and view key (`k`). Only links on the portal's API origin count.
 */
export const translationFromMessage = (text: string, apiBaseUrl: string): TranslationDescriptor | null => {
  const match = TRANSLATION_LINK.exec(text || '');
  if (!match) return null;
  const [, root, jobId, viewKey] = match;
  try {
    if (new URL(root).origin !== new URL(apiBaseUrl).origin) return null;
  } catch {
    return null;
  }
  const base = `${root}/translate`;
  const qs = `jobId=${jobId}&k=${viewKey}`;
  const plain = text.replace(/<[^>]+>/g, ' ');
  const targetLang = /Translation to Arabic|إلى العربية/.test(plain) ? 'ar'
    : /Translation to English|إلى الإنجليزية/.test(plain) ? 'en' : undefined;
  const pages = Number(/·\s*(\d+)\s*(?:pages?|صفحة)/.exec(plain)?.[1]) || undefined;
  return {
    jobId: decodeURIComponent(jobId),
    viewKey: decodeURIComponent(viewKey),
    status: 'done',
    targetLang,
    sourceLang: targetLang ? (targetLang === 'ar' ? 'en' : 'ar') : undefined,
    pages,
    links: {
      pdf: `${base}/export?${qs}`,
      html: `${base}/document?${qs}&download=1`,
      view: `${base}/document?${qs}`,
    },
  };
};

/** Page-image URL for one page, derived from the job's view link. */
export const translationPageImageUrl = (links: TranslationLinks, page: number): string =>
  links.view.replace('/translate/document?', '/translate/page-image?') + '&page=' + page;


/** Remove legacy download anchors only for this translation; buttons remain backend-owned. */
export const translationDisplayHtml = (html: string, translation: TranslationDescriptor | null | undefined, actions?: Array<{ action?: string; payload?: Record<string, any> }>): string => {
  if (!translation || typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let view: URL;
  try { view = new URL(translation.links.view); } catch { return html; }
  const hasPdf = actions?.some(a => a.action === 'translation.download' && a.payload?.format === 'pdf' && a.payload?.jobId === translation.jobId);
  doc.querySelectorAll('a[href]').forEach(anchor => {
    try {
      const link = new URL(anchor.getAttribute('href') || '', view);
      if (link.origin !== view.origin || link.searchParams.get('jobId') !== translation.jobId) return;
      if ((link.pathname === view.pathname && link.searchParams.get('download') === '1') ||
          (hasPdf && link.pathname === view.pathname.replace('/document', '/export'))) anchor.remove();
    } catch { /* retain unrelated links */ }
  });
  return doc.body.innerHTML;
};
