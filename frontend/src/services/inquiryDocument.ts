import { authFetch } from './authSession';

/**
 * Reference links in knowledge-base answers (Inquiry Bot, and General chat's
 * `search_mof_knowledge_base` tool) point at `/inquiry-document/<uuid>?page=N&heading=…`.
 * That is not a page of the portal: the chat opens it in the reference viewer,
 * which loads the PDF from the GoTrue-protected route `GET inquiry/document/view`.
 * Reference action buttons come from backend reference.open actions; parsing
 * a backend reference link here never creates an additional button.
 */
export interface InquiryDocumentRef {
  documentId: string;
  page: number;
  heading: string;
  /** `chat`: a file uploaded in a chat (`/chat-document/<id>`). Default: knowledge-base document. */
  kind?: 'inquiry' | 'chat';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const parseInquiryDocumentHref = (href: string | undefined | null): InquiryDocumentRef | null => {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, 'https://portal.invalid');
  } catch {
    return null;
  }
  const match = /^\/(inquiry|chat)-document\/([^/]+)\/?$/.exec(url.pathname);
  if (!match) return null;
  const documentId = decodeURIComponent(match[2]).toLowerCase();
  if (!UUID.test(documentId)) return null;
  return {
    documentId,
    page: Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1),
    heading: (url.searchParams.get('heading') || '').trim(),
    ...(match[1] === 'chat' ? { kind: 'chat' as const } : {}),
  };
};

/** Why a document could not be shown; the viewer turns each into a message. */
export type InquiryDocumentError = 'unauthorized' | 'not_found' | 'preview_not_ready' | 'failed';

export class InquiryDocumentLoadError extends Error {
  constructor(public readonly reason: InquiryDocumentError, message: string) {
    super(message);
    this.name = 'InquiryDocumentLoadError';
  }
}

export const inquiryDocumentViewUrl = (
  apiBaseUrl: string,
  ref: Pick<InquiryDocumentRef, 'documentId' | 'page' | 'kind'>,
): string =>
  `${apiBaseUrl.replace(/\/+$/, '')}/${ref.kind === 'chat' ? 'chat' : 'inquiry'}/document/view?documentId=${encodeURIComponent(ref.documentId)}&page=${ref.page}`;

/** The document as a PDF blob, plus the file name the workflow sent. */
export const fetchInquiryDocument = async (
  apiBaseUrl: string,
  ref: Pick<InquiryDocumentRef, 'documentId' | 'page' | 'kind'>,
  signal?: AbortSignal,
): Promise<{ blob: Blob; filename: string }> => {
  const response = await authFetch(inquiryDocumentViewUrl(apiBaseUrl, ref), { signal });
  if (!response.ok) {
    const reason: InquiryDocumentError =
      response.status === 401 ? 'unauthorized'
        : response.status === 404 ? 'not_found'
          : response.status === 409 ? 'preview_not_ready'
            : 'failed';
    throw new InquiryDocumentLoadError(reason, `HTTP ${response.status}`);
  }
  const blob = await response.blob();
  if (blob.type && !blob.type.includes('pdf')) {
    throw new InquiryDocumentLoadError('failed', `Unexpected content type ${blob.type}`);
  }
  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] || 'document.pdf';
  return { blob: blob.type ? blob : new Blob([blob], { type: 'application/pdf' }), filename };
};
