import DOMPurify from 'dompurify';
import { getPptAssetBaseUrl } from '../constants/chatConstants';
import { getSlideElements } from './presentationDeck';

export const sanitizePresentationHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['style'],
    ADD_ATTR: ['style'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['action', 'formaction', 'sandbox'],
  });
};

// A deck stores the asset address of the environment that generated it (an n8n host and port,
// a gateway's /ai prefix, or the {{baseURL}} placeholder). Every form points at this portal's own
// asset route, so images load wherever the deck was made.
const ASSET_URL = /(?:\{\{baseURL\}\}|https?:\/\/[^\s"'()<>/\\]+)?\/(?:webhook|ai)\/ppt\/asset\?path=/gi;

export const resolvePresentationAssetUrls = (html: string): string => html.replace(ASSET_URL, getPptAssetBaseUrl());

// Shows only the first slide at its native 1920×1080 size, for a scaled thumbnail.
const COVER_CANVAS_STYLE = `
<style id="mof-chat-cover-canvas">
  html, body { width: 1920px !important; height: 1080px !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
  body > main, #deck, .deck { display: block !important; width: 1920px !important; height: 1080px !important; margin: 0 !important; padding: 0 !important; gap: 0 !important; overflow: hidden !important; }
  .frame { width: 1920px !important; height: 1080px !important; margin: 0 !important; box-shadow: none !important; }
  .frame > .slide { transform: none !important; }
</style>`;

/** A safe, standalone document holding only the deck's cover slide; null when the deck has no slides. */
export const buildCoverSlideHtml = (deckHtml: string): string | null => {
  const doc = new DOMParser().parseFromString(
    sanitizePresentationHtml(resolvePresentationAssetUrls(deckHtml)),
    'text/html',
  );
  const slides = getSlideElements(doc);
  if (slides.length === 0) return null;
  slides.slice(1).forEach((slide) => (slide.closest<HTMLElement>('.frame') ?? slide).remove());
  doc.head.insertAdjacentHTML('beforeend', COVER_CANVAS_STYLE);
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
};
