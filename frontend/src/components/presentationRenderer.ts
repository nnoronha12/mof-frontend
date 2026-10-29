import { getPptAssetBaseUrl } from '../constants/chatConstants';
import type { PresentationDeckSpec, PresentationTemplateVariant } from '../services/presentationWorkflow';
import { setAccentHexOverrides } from './presentationDeck';
import SlotRendererModule from './slot-renderer';

// Synced from mof-deck-console 1.html: the final Deck API embeds this renderer too.
const SlotRenderer = SlotRendererModule as {
  renderDeck: (
    spec: PresentationDeckSpec,
    templates: Record<string, PresentationTemplateVariant>,
    shellHtml: string,
    options: { assetBase: string },
  ) => string;
  designDeck: (spec: PresentationDeckSpec, options: { seed: string; force: boolean; slideIds?: string[] }) => PresentationDeckSpec;
};

export const shufflePresentationDesign = (spec: PresentationDeckSpec, slideIds?: string[]): PresentationDeckSpec => {
  const seed = Math.random().toString(36).slice(2, 10);
  spec.design_seed = seed;
  return SlotRenderer.designDeck(spec, { seed, force: true, slideIds });
};

export const renderPresentationSpec = (
  spec: PresentationDeckSpec,
  shellHtml: string,
  variants: PresentationTemplateVariant[],
): string => {
  const templates = Object.fromEntries(variants.map((variant) => [variant.ref, variant]));
  const missing = spec.slides.find((slide) => !templates[`${slide.template.id}@${slide.template.version}`]);
  if (missing) throw new Error(`Template ${missing.template.id}@${missing.template.version} is missing from the catalog`);
  const html = SlotRenderer.renderDeck(spec, templates, shellHtml, { assetBase: getPptAssetBaseUrl() });
  return setAccentHexOverrides(html, spec.theme?.accentHex, spec.slides.map((slide) => ({ id: slide.id, hex: slide.accentHex })));
};
