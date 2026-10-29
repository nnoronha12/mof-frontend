export interface SlideSummary {
  index: number;
  number: string;
  label: string;
  id?: string;
  palette?: string;
}

const SLIDE_SELECTOR = 'section.slide, section[data-slide], article.slide';

const isSlideElement = (node: Element): node is HTMLElement =>
  node instanceof HTMLElement && node.matches(SLIDE_SELECTOR);

export const getSlideElements = (doc: Document): HTMLElement[] => {
  const deck = doc.querySelector('main.deck, .deck');
  const root = deck ?? doc.body;
  // A preview iframe that is still loading its srcdoc has no body yet.
  if (!root) return [];
  const direct = Array.from(root.children).filter(isSlideElement);
  if (direct.length > 0) return direct;
  return Array.from(doc.querySelectorAll(SLIDE_SELECTOR)).filter(isSlideElement);
};

const parseDocument = (html: string): Document =>
  new DOMParser().parseFromString(html, 'text/html');

const serializeDocument = (doc: Document): string => {
  const doctype = doc.doctype ? `<!doctype ${doc.doctype.name}>` : '<!doctype html>';
  return `${doctype}\n${doc.documentElement.outerHTML}`;
};

/** Apply saved accent overrides to the preview without changing the template CSS. */
export const setAccentHexOverrides = (
  html: string,
  deckHex: string | undefined,
  slideHexes: Array<{ id: string; hex?: string }>,
): string => {
  const doc = parseDocument(html);
  const mix = (hex: string, target: number, fraction: number) => {
    const values = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
    return `#${values.map((value) => Math.round(value * (1 - fraction) + target * fraction).toString(16).padStart(2, '0')).join('')}`;
  };
  getSlideElements(doc).forEach((slide) => {
    const override = slideHexes.find((item) => item.id === slide.dataset.slideId)?.hex || deckHex;
    if (!override || !/^#[0-9a-f]{6}$/i.test(override)) return;
    // Inline custom properties override palette classes, including gold-white.
    Object.entries({
      '--gold': override, '--gold-50': mix(override, 255, 0.95), '--gold-100': mix(override, 255, 0.85),
      '--gold-300': mix(override, 255, 0.45), '--gold-500': override,
      '--gold-600': mix(override, 0, 0.16), '--gold-800': mix(override, 0, 0.45),
      '--chart-1': override, '--accent': override, '--c-accent': override,
    }).forEach(([name, value]) => slide.style.setProperty(name, value, 'important'));
  });
  return serializeDocument(doc);
};

const slideLabel = (slide: HTMLElement, index: number): string => {
  const heading = slide.querySelector('h1, h2, h3');
  const text = (heading?.textContent || slide.querySelector('.eyebrow')?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return `Slide ${index + 1}`;
  return text.length > 48 ? `${text.slice(0, 48).trim()}…` : text;
};

export const summarizeSlides = (html: string): SlideSummary[] => {
  const slides = getSlideElements(parseDocument(html));
  return slides.map((slide, index) => ({
    index,
    number: String(index + 1).padStart(2, '0'),
    label: slideLabel(slide, index),
    id: slide.dataset.slideId,
    palette: Array.from(slide.classList).find((name) => name.startsWith('palette-'))?.slice(8),
  }));
};

const renumberSlides = (slides: HTMLElement[]) => {
  slides.forEach((slide, index) => {
    const number = index + 1;
    slide.setAttribute('data-slide', String(number));
    const page = slide.querySelector<HTMLElement>('[data-page-number]');
    if (page) {
      page.setAttribute('data-page-number', String(number));
      const textNode = Array.from(page.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.textContent = String(number).padStart(2, '0');
    }
  });
};

const rewriteSlides = (
  html: string,
  index: number,
  mutate: (slides: HTMLElement[]) => number,
): { html: string; index: number } | null => {
  const doc = parseDocument(html);
  const slides = getSlideElements(doc);
  if (index < 0 || index >= slides.length) return null;
  const nextIndex = mutate(slides);
  renumberSlides(getSlideElements(doc));
  return { html: serializeDocument(doc), index: nextIndex };
};

export const moveSlide = (
  html: string,
  index: number,
  direction: -1 | 1,
): { html: string; index: number } | null =>
  rewriteSlides(html, index, (slides) => {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return index;
    const current = slides[index];
    const other = slides[target];
    const parent = current.parentElement;
    if (!parent || other.parentElement !== parent) return index;
    if (direction < 0) parent.insertBefore(current, other);
    else parent.insertBefore(other, current);
    return target;
  });

export const deleteSlide = (
  html: string,
  index: number,
): { html: string; index: number } | null =>
  rewriteSlides(html, index, (slides) => {
    if (slides.length < 2) return index;
    slides[index].remove();
    return Math.min(index, slides.length - 2);
  });

/** Replace one rendered slide with an unsaved regeneration proposal for preview. */
export const replaceSlide = (
  html: string,
  index: number,
  replacementHtml: string,
): string | null => {
  const doc = parseDocument(html);
  const slides = getSlideElements(doc);
  const replacementSlides = getSlideElements(parseDocument(replacementHtml));
  if (!slides[index] || !replacementSlides[0]) return null;
  slides[index].replaceWith(doc.importNode(replacementSlides[0], true));
  renumberSlides(getSlideElements(doc));
  return serializeDocument(doc);
};
