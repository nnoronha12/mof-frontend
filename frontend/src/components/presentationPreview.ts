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

export const resolvePresentationAssetUrls = (html: string): string => {
  const assetBase = getPptAssetBaseUrl();
  return html
    .replaceAll('/webhook/ppt/asset?path=', '/ai/ppt/asset?path=')
    .replace(/https?:\/\/(?:127\.0\.0\.1|localhost|10\.\d+\.\d+\.\d+)(?::\d+)?\/ai\/ppt\/asset\?path=/gi, assetBase)
    .replace(/\{\{baseURL\}\}\/ai\/ppt\/asset\?path=/gi, assetBase);
};

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
