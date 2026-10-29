/** Chat v1 descriptors/actions are decoded by chatEnvelope.ts; viewer feature
 * controls require explicit backend actionButtons and are never inferred from a deck ID. */
import { getAccessToken, refreshAuthSession } from './authSession';
import { getPptWebhookBaseUrl } from '../constants/chatConstants';
import { backendActions, type ChatAction } from './chatEnvelope';

export type PresentationPalette = 'mof_classic' | 'sapphire' | 'uae_red' | 'national' | 'white_gold' | 'black_gold' | 'gold_white';

export interface PresentationSlotSchema {
  type?: string;
  max_chars?: number;
  required?: boolean;
  numeric?: boolean;
  editable?: boolean;
  llm?: boolean;
  hint?: string;
  source?: string;
  [key: string]: unknown;
}

export interface PresentationSlideSpec {
  id: string;
  position?: number;
  layout?: string;
  template: { id: string; version: number };
  content: Record<string, unknown>;
  palette?: PresentationPalette;
  accentHex?: string;
  metadata?: { slots?: Record<string, PresentationSlotSchema>; [key: string]: unknown };
  lint?: Array<{ path?: string; code?: string }>;
  [key: string]: unknown;
}

export interface PresentationDeckSpec {
  deck_id?: string;
  title?: string;
  language?: 'en' | 'ar';
  theme?: { id: PresentationPalette; accentHex?: string; [key: string]: unknown };
  meta?: { footer_text?: string; [key: string]: unknown };
  slides: PresentationSlideSpec[];
  [key: string]: unknown;
}

export interface PresentationDescriptor {
  deckId: string;
  revision: number;
  spec?: PresentationDeckSpec;
}

export interface PresentationTemplateVariant {
  id: string;
  version: number;
  ref: string;
  name: string;
  description?: string;
  html?: string;
  manifest: { layout?: string; slots?: Record<string, PresentationSlotSchema>; [key: string]: unknown };
}

export interface PresentationChange {
  revision: number;
  summary: string;
  source?: string;
  changedBy?: string;
  createdAt?: string;
  diff?: unknown;
}

interface WorkflowErrorBody {
  ok?: false;
  error?: { message?: string; currentRevision?: number };
}

const runtimeBase = () => {
  return getPptWebhookBaseUrl();
};

const endpoint = (path: string) => `${runtimeBase()}/${path.replace(/^\/+/, '')}`;

const authHeaders = (json = true): HeadersInit => {
  const token = getAccessToken();
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Token: token, token } : {}),
  };
};

const parseJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    const type = response.headers.get('content-type') || 'an invalid response';
    throw new Error(`Presentation API returned HTTP ${response.status} (${type}) instead of JSON. Please check the PPT API address.`);
  }
  const body = parsed && typeof parsed === 'object' && 'body' in parsed
    ? (parsed as { body: unknown }).body
    : parsed;
  const normalized = typeof body === 'string' ? JSON.parse(body) : body;
  if (!response.ok || (normalized as WorkflowErrorBody)?.ok === false) {
    const error = normalized as WorkflowErrorBody;
    const conflict = error.error?.currentRevision;
    const message = error.error?.message || `Presentation workflow returned HTTP ${response.status}`;
    const failure = new Error(message) as Error & { currentRevision?: number };
    if (typeof conflict === 'number') failure.currentRevision = conflict;
    throw failure;
  }
  return normalized as T;
};

const fetchWithAuth = async (input: RequestInfo | URL, init: RequestInit) => {
  await refreshAuthSession(false);
  const perform = () => {
    const headers = new Headers(init.headers);
    const token = getAccessToken();
    if (token) headers.set('Token', token);
    return fetch(input, { ...init, headers });
  };
  let response = await perform();
  if (response.status === 401 && await refreshAuthSession(true)) {
    response = await perform();
  }
  return response;
};

export const getPresentationDeck = async (deckId: string) => {
  const response = await fetchWithAuth(
    `${endpoint('ppt/deck')}?deckId=${encodeURIComponent(deckId)}`,
    { headers: authHeaders(false) },
  );
  return parseJson<{
    ok: true;
    deck: { id: string; revision: number; title?: string };
    spec: PresentationDeckSpec;
    html: string;
  }>(response);
};

/** The deck a Presentation chat produced, to reopen it from History; null when the chat has none yet. */
export const getPresentationChatDeckId = async (sessionId: string): Promise<string | null> => {
  const response = await fetchWithAuth(
    `${endpoint('ppt/chat-history')}?sessionId=${encodeURIComponent(sessionId)}`,
    { headers: authHeaders(false) },
  );
  if (response.status === 404) return null;
  const result = await parseJson<{ ok: true; deckId?: string | null }>(response);
  return result.deckId || null;
};

export interface PresentationDeckSummary {
  deckId: string;
  title: string;
  topic: string;
  language: 'en' | 'ar';
  revision: number;
  slideCount: number;
  palette: string | null;
  chatSessionId: string | null;
  createdAt: string;
  updatedAt: string;
  actionButtons?: { buttons: ChatAction[] };
}

/** Owned decks, newest first. UAT returns per-deck viewer actions; retain only
 * actions bound to that deck so History restores editing and export controls. */
export const listMyPresentationDecks = async (limit = 30): Promise<PresentationDeckSummary[]> => {
  const response = await fetchWithAuth(
    `${endpoint('ppt/my-decks')}?limit=${encodeURIComponent(String(limit))}`,
    { headers: authHeaders(false) },
  );
  const result = await parseJson<{ ok: true; decks?: PresentationDeckSummary[] }>(response);
  return Array.isArray(result.decks) ? result.decks.map(deck=>({...deck,
    actionButtons:{buttons:backendActions(deck.actionButtons?.buttons).filter(action=>action.payload?.deckId===deck.deckId)},
  })) : [];
};

export const getPresentationCatalog = async () => {
  const response = await fetchWithAuth(endpoint('ppt/catalog'), { headers: authHeaders(false) });
  return parseJson<{
    ok: true;
    shell?: { id: string; version: number; html: string };
    themes?: Array<{ id: string; name?: string }>;
    assetBase?: string;
    slideTypes: Array<{ layout: string; label: string; variants: PresentationTemplateVariant[] }>;
  }>(response);
};

export const getPresentationSlideTemplates = async (refs: string[]): Promise<PresentationTemplateVariant[]> => {
  const response = await fetchWithAuth(
    `${endpoint('ppt/slide-templates')}?ids=${encodeURIComponent(refs.join(','))}`,
    { headers: authHeaders(false) },
  );
  const result = await parseJson<{ ok: true; templates: Array<Omit<PresentationTemplateVariant, 'ref'>> }>(response);
  return result.templates.map((template) => ({ ...template, ref: `${template.id}@${template.version}` }));
};

export const getPresentationChanges = async (deckId: string) => {
  const response = await fetchWithAuth(
    `${endpoint('ppt/deck-changes')}?deckId=${encodeURIComponent(deckId)}`,
    { headers: authHeaders(false) },
  );
  return parseJson<{ ok: true; changes: PresentationChange[] }>(response);
};

export const savePresentationDeck = async (
  descriptor: PresentationDescriptor,
  spec: PresentationDeckSpec,
  userId: string,
) => {
  const response = await fetchWithAuth(endpoint('ppt/deck-save'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      deckId: descriptor.deckId,
      baseRevision: descriptor.revision,
      spec,
      userId,
    }),
  });
  return parseJson<{ ok: true; deckId: string; revision: number; html: string; warnings?: unknown[] }>(response);
};

export const regeneratePresentationSlide = async (
  descriptor: PresentationDescriptor,
  slideId: string,
  instruction: string,
  userId: string,
) => {
  const response = await fetchWithAuth(endpoint('ppt/slide-regenerate'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      deckId: descriptor.deckId,
      baseRevision: descriptor.revision,
      slideId,
      instruction,
      userId,
    }),
  });
  return parseJson<{
    ok: true;
    deckId: string;
    baseRevision: number;
    slideId: string;
    proposal: { slide: PresentationSlideSpec; html: string };
  }>(response);
};

export const regeneratePresentationDeck = async (
  descriptor: PresentationDescriptor,
  instruction: string,
  userId: string,
) => {
  const response = await fetchWithAuth(endpoint('ppt/deck-regenerate'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      deckId: descriptor.deckId,
      baseRevision: descriptor.revision,
      instruction,
      userId,
    }),
  });
  return parseJson<{
    ok: true;
    deckId: string;
    baseRevision: number;
    proposal: { spec: PresentationDeckSpec; html: string };
    changed?: string[];
    warnings?: string[];
  }>(response);
};

export const exportPresentationDeck = async (
  descriptor: PresentationDescriptor,
  format: 'pdf' | 'pptx',
): Promise<{ blob: Blob; filename: string }> => {
  const response = await fetchWithAuth(endpoint('ppt/export'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ deckId: descriptor.deckId, revision: descriptor.revision, format }),
  });
  if (!response.ok) await parseJson(response);
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
  return {
    blob: await response.blob(),
    filename: match ? decodeURIComponent(match[1].replace(/"/g, '')) : `mof-presentation.${format}`,
  };
};
