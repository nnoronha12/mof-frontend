import { hasBackendAction, type ChatAction } from '../services/chatEnvelope';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowsPointingOutIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  deleteSlide,
  getSlideElements,
  moveSlide,
  replaceSlide,
  summarizeSlides,
} from './presentationDeck';
import { renderPresentationSpec, shufflePresentationDesign } from './presentationRenderer';
import { resolvePresentationAssetUrls, sanitizePresentationHtml } from './presentationPreview';
import { ensureUtf8Charset, HTML_FILE_TYPE } from '../utils/htmlFile';
import {
  exportPresentationDeck,
  getPresentationDeck,
  getPresentationCatalog,
  getPresentationSlideTemplates,
  getPresentationChanges,
  PresentationChange,
  PresentationDeckSpec,
  PresentationDescriptor,
  PresentationPalette,
  PresentationSlotSchema,
  PresentationTemplateVariant,
  regeneratePresentationDeck,
  regeneratePresentationSlide,
  savePresentationDeck,
} from '../services/presentationWorkflow';
import { PRESENTATION_VIEWER_TEXT, PresentationViewerText } from './presentationViewerText';
import { PresentationHistoryList } from './PresentationHistoryPanel';
import type { PresentationDeckSummary } from '../services/presentationWorkflow';

interface PresentationViewerProps {
  html: string;
  actions?: ChatAction[];
  presentation?: PresentationDescriptor | null;
  userId?: string;
  onClose: () => void;
  onHtmlChange?: (html: string) => void;
  onPresentationChange?: (presentation: PresentationDescriptor) => void;
  isArabic?: boolean;
  /** Adds a History tab listing the user's past decks (Presentation service). */
  history?: { accentColor: string; onOpenDeck: (deck: PresentationDeckSummary) => void };
}

const PALETTES: Array<{ id: keyof PresentationViewerText['palettes'] }> = [
  { id: 'mof_classic' },
  { id: 'sapphire' },
  { id: 'uae_red' },
  { id: 'national' },
];

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;
const SLIDE_GAP = 32;

// Keep every slide at its native size and scale the entire deck as one canvas.
// Only the outer deck layout is normalized; template styling stays intact.
const FIXED_CANVAS_STYLE = `
<style id="mof-chat-preview-canvas">
  html, body { width: 1920px !important; height: auto !important; margin: 0 !important; overflow: visible !important; }
  body { padding: 0 !important; background: #eef0f2 !important; }
  body > main, #deck, .deck { display: flex !important; flex-direction: column !important; align-items: center !important; width: 1920px !important; height: auto !important; margin: 0 !important; padding: 0 !important; gap: 32px !important; overflow: visible !important; }
  .frame { width: 1920px !important; height: 1080px !important; margin: 0 !important; box-shadow: none !important; }
  .frame > .slide { transform: none !important; }
</style>`;

const FLUID_CANVAS_STYLE = `
<style id="mof-chat-preview-canvas">
  html, body { margin: 0 !important; overflow: hidden !important; }
  body { padding: 0 !important; }
  body > main, #deck, .deck { margin: 0 !important; padding: 0 !important; gap: 0 !important; }
</style>`;

const cloneSpec = (spec: PresentationDeckSpec): PresentationDeckSpec =>
  JSON.parse(JSON.stringify(spec)) as PresentationDeckSpec;

const prepareDeckPreview = (html: string): { html: string; fixedCanvas: boolean; slideCount: number } => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const slides = getSlideElements(doc);
  const frame = slides[0]?.closest<HTMLElement>('.frame');
  // Current generated decks have direct 1920×1080 <section> children, while
  // some template previews wrap the section in .frame.
  const fixedCanvas = !!frame || (/1920px/i.test(html) && /1080px/i.test(html));
  doc.head.insertAdjacentHTML('beforeend', fixedCanvas ? FIXED_CANVAS_STYLE : FLUID_CANVAS_STYLE);
  const doctype = doc.doctype ? `<!doctype ${doc.doctype.name}>` : '<!doctype html>';
  return { html: `${doctype}\n${doc.documentElement.outerHTML}`, fixedCanvas, slideCount: slides.length };
};

const humanize = (value: string) =>
  value.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

const readPreviewAccent = (doc: Document | null | undefined, index: number): string | null => {
  if (!doc?.defaultView) return null;
  const slide = getSlideElements(doc)[index];
  if (!slide) return null;
  const css = doc.defaultView.getComputedStyle(slide);
  const value = (css.getPropertyValue('--gold-500') || css.getPropertyValue('--gold')).trim();
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  return match ? `#${match[1].toUpperCase()}` : null;
};

interface ValueEditorProps {
  label: string;
  value: unknown;
  schema?: PresentationSlotSchema;
  onChange: (value: unknown) => void;
  depth?: number;
  text: PresentationViewerText;
}

const emptyValueForSchema = (schema?: PresentationSlotSchema): unknown => {
  if (!schema) return '';
  if (schema.type === 'list') return [];
  if (schema.type === 'table') return { head: [], rows: [] };
  if (schema.type === 'chart') return { type: 'bar', labels: [], series: [] };
  if (schema.type === 'image') return { src: '', alt: '' };
  const nested = Object.entries(schema).filter(([key, value]) =>
    !['type', 'min', 'max', 'required', 'hint', 'editable', 'llm'].includes(key) && value && typeof value === 'object',
  );
  return nested.length ? Object.fromEntries(nested.map(([key, value]) => [key, emptyValueForSchema(value as PresentationSlotSchema)])) : '';
};

const ValueEditor: React.FC<ValueEditorProps> = ({ label, value, schema, onChange, depth = 0, text: T }) => {
  if (Array.isArray(value)) {
    const minimum = Number(schema?.min ?? 0);
    const maximum = Number(schema?.max ?? 99);
    const itemSchema = schema?.item as PresentationSlotSchema | undefined;
    return (
      <fieldset className="rounded-lg border border-[#EAECF0] bg-[#F9FAFB] p-2">
        <legend className="px-1 text-[11px] font-semibold text-[#344054]">{humanize(label)} <span className="font-normal text-[#98A2B3]">({value.length})</span></legend>
        <div className="space-y-2">
          {value.map((item, index) => (
            <div key={`${label}-${index}`} className="relative rounded-md border border-[#EAECF0] bg-white p-2 pe-8">
              <ValueEditor label={`${index + 1}`} value={item} schema={itemSchema} depth={depth + 1} text={T} onChange={(next) => {
                  const copy = value.slice();
                  copy[index] = next;
                  onChange(copy);
                }} />
              <button type="button" aria-label={T.removeItemAria(humanize(label), index + 1)} title={T.removeItem} className="absolute end-1 top-1 rounded p-1 text-[#B42318] hover:bg-[#FEE4E2] disabled:opacity-30" disabled={value.length <= minimum} onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}><TrashIcon className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <button type="button" className="w-full rounded-md border border-dashed border-[#92722A] px-2 py-1 text-[11px] font-semibold text-[#7C5E24] disabled:opacity-40" disabled={value.length >= maximum} onClick={() => onChange([...value, emptyValueForSchema(itemSchema)])}>{T.addItem}</button>
        </div>
      </fieldset>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <fieldset className="rounded-lg border border-[#D0D5DD] bg-white p-2">
        <legend className="px-1 text-[11px] font-semibold text-[#344054]">{humanize(label)}</legend>
        <div className="space-y-2">
          {Object.entries(value as Record<string, unknown>).map(([key, nested]) => (
            <ValueEditor
              key={key}
              label={key}
              value={nested}
              depth={depth + 1}
              text={T}
              onChange={(next) => onChange({ ...(value as Record<string, unknown>), [key]: next })}
            />
          ))}
        </div>
      </fieldset>
    );
  }

  const text = value == null ? '' : String(value);
  const max = schema?.max_chars;
  const isNumber = typeof value === 'number';
  const multiline = !isNumber && (text.length > 50 || (max ?? 0) > 80);
  const common = {
    value: text,
    maxLength: max,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(isNumber ? Number(event.target.value) : event.target.value),
    className: 'w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#101828] focus:border-[#C6A75D] focus:outline-none',
  };
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-[#475467]">
        {depth ? humanize(label) : humanize(label)}
        {max ? <small className={text.length > max ? 'text-[#B42318]' : 'text-[#98A2B3]'}>{text.length}/{max}</small> : null}
      </span>
      {multiline ? <textarea {...common} rows={2} /> : <input {...common} type={isNumber ? 'number' : 'text'} />}
      {schema?.hint ? <small className="mt-1 block text-[10px] text-[#98A2B3]">{schema.hint}</small> : null}
    </label>
  );
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  // Attach before clicking and keep the URL alive: large files (PPTX) can be
  // dropped when the blob URL is revoked right after the click.
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
};

export const PresentationViewer: React.FC<PresentationViewerProps> = ({
  html,
  actions,
  presentation,
  userId = 'user',
  onClose,
  onHtmlChange,
  onPresentationChange,
  isArabic = false,
  history,
}) => {
  const T = isArabic ? PRESENTATION_VIEWER_TEXT.ar : PRESENTATION_VIEWER_TEXT.en;
  // Error details from the services are English; Arabic shows the localised fallback instead.
  const errorText = (error: unknown, fallback: string) => (!isArabic && error instanceof Error ? error.message : fallback);
  const [draftHtml, setDraftHtml] = useState(html);
  const [descriptor, setDescriptor] = useState<PresentationDescriptor | null>(presentation ?? null);
  const authorizedActions=actions?.filter(action=>action.payload?.deckId===descriptor?.deckId&&!!descriptor?.deckId);
  const [draftSpec, setDraftSpec] = useState<PresentationDeckSpec | null>(presentation?.spec ? cloneSpec(presentation.spec) : null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [instruction, setInstruction] = useState('');
  const [proposal, setProposal] = useState<{ spec: PresentationDeckSpec; html: string; scope: 'slide' | 'deck' } | null>(null);
  const [templateVariants, setTemplateVariants] = useState<PresentationTemplateVariant[]>([]);
  const [catalogShell, setCatalogShell] = useState<string | null>(null);
  const requestedTemplateRefs = useRef(new Set<string>());
  const [changes, setChanges] = useState<PresentationChange[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'slides' | 'history'>('slides');
  const [width, setWidth] = useState(980);
  const draftRef = useRef(html);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const [previewScale, setPreviewScale] = useState(0.25);
  const [accentScope, setAccentScope] = useState<'slide' | 'deck'>('slide');
  const [accentInput, setAccentInput] = useState('#B79A55');
  const resizingRef = useRef(false);

  useEffect(() => {
    if (html === draftRef.current) return;
    draftRef.current = html;
    setDraftHtml(html);
    setSelectedIndex(0);
  }, [html]);

  useEffect(() => {
    setDescriptor(presentation ?? null);
    if (presentation?.spec) {
      setDraftSpec(cloneSpec(presentation.spec));
      setDirty(false);
      return;
    }
    // A fresh backend descriptor intentionally invalidates any spec retained
    // from the previously open deck. The loader below fetches the matching
    // revision before edit controls become available.
    setDraftSpec(null);
    setDirty(false);
    setSelectedIndex(0);
  }, [presentation]);

  // A newly generated or newly opened deck is shown on the Slides tab.
  useEffect(() => {
    setActiveTab('slides');
  }, [presentation?.deckId]);

  useEffect(() => {
    if (!descriptor?.deckId || draftSpec) return;
    let cancelled = false;
    setBusy(T.loadingDeck);
    getPresentationDeck(descriptor.deckId)
      .then((result) => {
        if (cancelled) return;
        const next = { deckId: result.deck.id, revision: result.deck.revision, spec: result.spec };
        setDescriptor(next);
        setDraftSpec(cloneSpec(result.spec));
        setDraftHtml(result.html);
        draftRef.current = result.html;
        onHtmlChange?.(result.html);
        onPresentationChange?.(next);
      })
      .catch((error) => !cancelled && setStatus(errorText(error, T.unableToLoadDeck)))
      .finally(() => !cancelled && setBusy(null));
    return () => { cancelled = true; };
  }, [descriptor?.deckId, draftSpec, onHtmlChange, onPresentationChange]);

  useEffect(() => {
    let cancelled = false;
    getPresentationCatalog()
      .then((result) => {
        if (!cancelled) {
          setTemplateVariants(result.slideTypes.flatMap((type) => type.variants));
          setCatalogShell(result.shell?.html || null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setTemplateVariants([]);
          setCatalogShell(null);
          setStatus(T.unableToLoadDesigns(error instanceof Error ? error.message : String(error)));
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!draftSpec || !catalogShell) return;
    const loaded = new Set(templateVariants.map((variant) => variant.ref));
    const missing = [...new Set(draftSpec.slides.map((slide) => `${slide.template.id}@${slide.template.version}`))]
      .filter((ref) => !loaded.has(ref) && !requestedTemplateRefs.current.has(ref));
    if (!missing.length) return;
    missing.forEach((ref) => requestedTemplateRefs.current.add(ref));
    let cancelled = false;
    getPresentationSlideTemplates(missing)
      .then((templates) => {
        if (!cancelled) setTemplateVariants((current) => [...current, ...templates.filter((template) => !current.some((item) => item.ref === template.ref))]);
      })
      .catch((error) => { if (!cancelled) setStatus(errorText(error, T.unableToLoadTemplates)); });
    return () => { cancelled = true; };
  }, [draftSpec, catalogShell, templateVariants]);

  useEffect(() => {
    if (!descriptor?.deckId) { setChanges([]); return; }
    let cancelled = false;
    getPresentationChanges(descriptor.deckId)
      .then((result) => { if (!cancelled) setChanges(result.changes); })
      .catch(() => { if (!cancelled) setChanges([]); });
    return () => { cancelled = true; };
  }, [descriptor?.deckId, descriptor?.revision]);

  const selectedSpecSlide = draftSpec?.slides[selectedIndex];
  useEffect(() => {
    const hex = accentScope === 'slide' ? selectedSpecSlide?.accentHex : draftSpec?.theme?.accentHex;
    const palette = accentScope === 'slide' ? selectedSpecSlide?.palette || draftSpec?.theme?.id : draftSpec?.theme?.id;
    setAccentInput(hex || draftSpec?.theme?.accentHex || readPreviewAccent(previewFrameRef.current?.contentDocument, selectedIndex) || (palette === 'gold_white' ? '#FFFFFF' : '#B79A55'));
  }, [accentScope, selectedIndex, selectedSpecSlide?.accentHex, selectedSpecSlide?.palette, draftSpec?.theme?.accentHex, draftSpec?.theme?.id]);
  const renderedDraftHtml = useMemo(() => {
    if (!draftSpec || !catalogShell || !templateVariants.length) return draftHtml;
    try { return renderPresentationSpec(draftSpec, catalogShell, templateVariants); }
    catch { return draftHtml; }
  }, [draftHtml, draftSpec, catalogShell, templateVariants]);
  const slides = useMemo(() => summarizeSlides(renderedDraftHtml), [renderedDraftHtml]);
  const selectedSlide = slides[selectedIndex];
  const previewHtml = useMemo(() => {
    if (!proposal) return renderedDraftHtml;
    if (catalogShell && templateVariants.length) {
      try { return renderPresentationSpec(proposal.spec, catalogShell, templateVariants); }
      catch { /* Fall back to the workflow's proposal HTML. */ }
    }
    if (proposal.scope === 'deck') return proposal.html;
    return replaceSlide(renderedDraftHtml, selectedIndex, proposal.html) || renderedDraftHtml;
  }, [renderedDraftHtml, proposal, selectedIndex, catalogShell, templateVariants]);
  const preview = useMemo(
    () => prepareDeckPreview(sanitizePresentationHtml(resolvePresentationAssetUrls(previewHtml))),
    [previewHtml],
  );

  useEffect(() => {
    if (!preview.fixedCanvas || !previewStageRef.current) return;
    const stage = previewStageRef.current;
    const fit = () => setPreviewScale(Math.max(0.01, (stage.clientWidth - 24) / SLIDE_WIDTH));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [preview.fixedCanvas, isCollapsed]);

  const scrollToSlide = (index: number) => {
    const stage = previewStageRef.current;
    const frame = previewFrameRef.current;
    if (preview.fixedCanvas && stage) {
      stage.scrollTo({ top: index * (SLIDE_HEIGHT + SLIDE_GAP) * previewScale, behavior: 'smooth' });
    } else {
      const slide = frame?.contentDocument && getSlideElements(frame.contentDocument)[index];
      slide?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    setSelectedIndex(index);
    setInstruction('');
  };

  const handlePreviewLoad = () => {
    const frame = previewFrameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;
    if (!(accentScope === 'slide' ? selectedSpecSlide?.accentHex : draftSpec?.theme?.accentHex)) {
      const shownHex = readPreviewAccent(doc, selectedIndex);
      if (shownHex) setAccentInput(shownHex);
    }
    doc.addEventListener('click', (event) => {
      const slide = (event.target as Element)?.closest?.('section.slide, section[data-slide], article.slide');
      if (!slide) return;
      const index = getSlideElements(doc).indexOf(slide as HTMLElement);
      if (index >= 0) setSelectedIndex(index);
    });
    if (preview.fixedCanvas) {
      // Wheel events inside an iframe do not bubble to the outer scroll panel.
      doc.addEventListener('wheel', (event) => {
        event.preventDefault();
        previewStageRef.current?.scrollBy({ top: event.deltaY, left: event.deltaX });
      }, { passive: false });
    } else {
      doc.defaultView?.addEventListener('scroll', () => {
        const items = getSlideElements(doc);
        const index = items.findIndex((slide) => slide.getBoundingClientRect().bottom > 80);
        if (index >= 0) setSelectedIndex(index);
      }, { passive: true });
    }
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!resizingRef.current) return;
      // The panel sits at the inline end: the right edge in English, the left edge in Arabic.
      const next = isArabic ? event.clientX : window.innerWidth - event.clientX;
      setWidth(Math.max(760, Math.min(1400, next)));
    };
    const stopResizing = () => {
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
    };
  }, [isArabic]);

  const publish = (nextHtml: string, nextDescriptor: PresentationDescriptor, nextSpec: PresentationDeckSpec) => {
    draftRef.current = nextHtml;
    setDraftHtml(nextHtml);
    setDescriptor(nextDescriptor);
    setDraftSpec(cloneSpec(nextSpec));
    setDirty(false);
    setProposal(null);
    onHtmlChange?.(nextHtml);
    onPresentationChange?.(nextDescriptor);
  };

  const saveSpec = async (
    nextSpec: PresentationDeckSpec,
    optimistic?: { html: string; index: number } | null,
    message = T.saved,
  ) => {
    if (!descriptor) {
      if (optimistic) {
        draftRef.current = optimistic.html;
        setDraftHtml(optimistic.html);
        setSelectedIndex(optimistic.index);
        onHtmlChange?.(optimistic.html);
      }
      setDraftSpec(nextSpec);
      setDirty(true);
      setStatus(T.localOnly);
      return true;
    }
    const previousHtml = draftHtml;
    if (optimistic) {
      draftRef.current = optimistic.html;
      setDraftHtml(optimistic.html);
      setSelectedIndex(optimistic.index);
    }
    setBusy(T.saving);
    setStatus('');
    try {
      const result = await savePresentationDeck(descriptor, nextSpec, userId);
      // The final Deck API normalises themes and slide designs while saving.
      // Read the authoritative revision back before the next regeneration.
      const readback = await getPresentationDeck(result.deckId).catch(() => null);
      const saved = readback?.deck.revision === result.revision ? readback : null;
      const savedSpec = saved?.spec || nextSpec;
      const nextDescriptor = { deckId: result.deckId, revision: result.revision, spec: savedSpec };
      publish(saved?.html || result.html, nextDescriptor, savedSpec);
      getPresentationChanges(result.deckId).then((history) => setChanges(history.changes)).catch(() => undefined);
      setStatus(T.savedWithRevision(message, result.revision));
      return true;
    } catch (error) {
      draftRef.current = previousHtml;
      setDraftHtml(previousHtml);
      setStatus(errorText(error, T.unableToSave));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const mutateSlides = (
    operation: 'up' | 'down' | 'delete',
  ) => {
    if (!draftSpec) {
      const local = operation === 'delete'
        ? deleteSlide(draftHtml, selectedIndex)
        : moveSlide(draftHtml, selectedIndex, operation === 'up' ? -1 : 1);
      if (local) {
        draftRef.current = local.html;
        setDraftHtml(local.html);
        setSelectedIndex(local.index);
        onHtmlChange?.(local.html);
      }
      return;
    }
    const spec = cloneSpec(draftSpec);
    let nextIndex = selectedIndex;
    if (operation === 'delete') {
      if (spec.slides.length < 2) return;
      spec.slides.splice(selectedIndex, 1);
      nextIndex = Math.min(selectedIndex, spec.slides.length - 1);
    } else {
      const target = selectedIndex + (operation === 'up' ? -1 : 1);
      if (target < 0 || target >= spec.slides.length) return;
      [spec.slides[selectedIndex], spec.slides[target]] = [spec.slides[target], spec.slides[selectedIndex]];
      nextIndex = target;
    }
    spec.slides.forEach((slide, index) => { slide.position = index + 1; });
    const optimistic = operation === 'delete'
      ? deleteSlide(draftHtml, selectedIndex)
      : moveSlide(draftHtml, selectedIndex, operation === 'up' ? -1 : 1);
    setSelectedIndex(nextIndex);
    void saveSpec(spec, optimistic, operation === 'delete' ? T.slideDeleted : T.slidesReordered);
  };

  const changeDeckPalette = (palette: PresentationPalette) => {
    if (!draftSpec) return;
    const spec = cloneSpec(draftSpec);
    // The final renderer owns palette classes and backgrounds. A palette is a
    // deck theme, while individual slides use background/pattern controls.
    spec.theme = { id: palette };
    spec.slides.forEach((slide) => { delete slide.accentHex; delete slide.palette; });
    setDraftSpec(spec);
    setDirty(true);
    setStatus(T.unsavedPalette);
  };

  const changeAccentHex = (value: string) => {
    setAccentInput(value);
    if (!draftSpec || !/^#[0-9a-f]{6}$/i.test(value)) return;
    const hex = value.toUpperCase();
    const spec = cloneSpec(draftSpec);
    if (accentScope === 'deck') {
      spec.theme = { ...(spec.theme || { id: 'mof_classic' }), accentHex: hex };
      // Applying to all slides clears earlier slide-specific colour overrides.
      spec.slides.forEach((slide) => { delete slide.accentHex; });
    } else {
      spec.slides[selectedIndex].accentHex = hex;
    }
    setDraftSpec(spec);
    setDirty(true);
    setStatus(T.unsavedAccent(accentScope === 'deck', selectedIndex + 1));
  };

  const changeSlideDesign = (field: 'background' | 'pattern', value: string) => {
    if (!draftSpec) return;
    const spec = cloneSpec(draftSpec);
    delete spec.slides[selectedIndex].palette;
    spec.slides[selectedIndex][field] = value;
    setDraftSpec(spec);
    setDirty(true);
    setStatus(T.unsavedSlideField(field));
  };

  const shuffleDesign = () => {
    if (!draftSpec) return;
    const spec = shufflePresentationDesign(cloneSpec(draftSpec));
    setDraftSpec(spec);
    setDirty(true);
    setStatus(T.unsavedShuffle);
  };

  const changeTitle = (title: string) => {
    if (!draftSpec) return;
    const spec = cloneSpec(draftSpec);
    spec.title = title.slice(0, 120);
    setDraftSpec(spec);
    setDirty(true);
    setStatus(T.unsavedTitle);
  };

  const addSlide = () => {
    if (!draftSpec || !selectedSpecSlide) return;
    const spec = cloneSpec(draftSpec);
    const copy = cloneSpec({ slides: [selectedSpecSlide] }).slides[0];
    copy.id = `s-${Date.now()}`;
    copy.content = Object.fromEntries(Object.keys(copy.content || {}).map((key) => [key, '']));
    spec.slides.splice(selectedIndex + 1, 0, copy);
    spec.slides.forEach((slide, index) => { slide.position = index + 1; });
    setSelectedIndex(selectedIndex + 1);
    void saveSpec(spec, null, T.slideAdded);
  };

  const switchTemplate = (ref: string) => {
    if (!draftSpec || !selectedSpecSlide) return;
    const variant = templateVariants.find((item) => item.ref === ref);
    if (!variant) return;
    const spec = cloneSpec(draftSpec);
    const slide = spec.slides[selectedIndex];
    const slots = variant.manifest.slots || {};
    slide.template = { id: variant.id, version: variant.version };
    slide.layout = variant.manifest.layout || slide.layout;
    slide.metadata = variant.manifest;
    slide.content = Object.fromEntries(Object.entries(slots).map(([key, schema]) => [
      key,
      slide.content[key] ?? (schema.type === 'list' ? [] : schema.type === 'table' ? { head: [], rows: [] } : schema.type === 'chart' ? { type: 'bar', labels: [], series: [] } : ''),
    ]));
    void saveSpec(spec, null, T.slideDesignChanged);
  };

  const reloadDeck = async () => {
    if (!descriptor?.deckId || dirty) return;
    setBusy(T.reloading);
    try {
      const result = await getPresentationDeck(descriptor.deckId);
      const next = { deckId: result.deck.id, revision: result.deck.revision, spec: result.spec };
      publish(result.html, next, result.spec);
      setStatus(T.reloaded);
    } catch (error) {
      setStatus(errorText(error, T.unableToReload));
    } finally {
      setBusy(null);
    }
  };

  const updateSelectedContent = (key: string, value: unknown) => {
    if (!draftSpec) return;
    const spec = cloneSpec(draftSpec);
    spec.slides[selectedIndex].content = { ...spec.slides[selectedIndex].content, [key]: value };
    setDraftSpec(spec);
    setDirty(true);
    setStatus(T.unsavedContent);
  };

  const regenerate = async () => {
    if (!descriptor || !selectedSpecSlide || dirty || proposal) return;
    setBusy(T.regeneratingSlide);
    setStatus('');
    try {
      const result = await regeneratePresentationSlide(
        descriptor,
        selectedSpecSlide.id,
        instruction.trim(),
        userId,
      );
      const spec = cloneSpec(draftSpec!);
      spec.slides[selectedIndex] = result.proposal.slide;
      setProposal({ spec, html: result.proposal.html, scope: 'slide' });
      setStatus(T.slideProposalStatus);
      setInstruction('');
    } catch (error) {
      setStatus(errorText(error, T.unableToRegenerateSlide));
    } finally {
      setBusy(null);
    }
  };

  const regenerateDeck = async () => {
    if (!descriptor || !draftSpec || dirty || proposal) return;
    setBusy(T.regeneratingDeck);
    setStatus('');
    try {
      const result = await regeneratePresentationDeck(descriptor, instruction.trim(), userId);
      setProposal({ spec: cloneSpec(result.proposal.spec), html: result.proposal.html, scope: 'deck' });
      setStatus(T.deckProposalStatus);
      setInstruction('');
    } catch (error) {
      setStatus(errorText(error, T.unableToRegenerateDeck));
    } finally {
      setBusy(null);
    }
  };

  const keepProposal = async () => {
    if (!proposal) return;
    const accepted = await saveSpec(
      proposal.spec,
      null,
      proposal.scope === 'deck' ? T.deckRegenerated : T.slideRegenerated,
    );
    if (accepted) setProposal(null);
  };

  const exportDeck = async (format: 'pdf' | 'pptx') => {
    if (!descriptor || dirty) return;
    setBusy(T.preparingExport(format.toUpperCase()));
    setStatus('');
    try {
      const file = await exportPresentationDeck(descriptor, format);
      downloadBlob(file.blob, file.filename);
      setStatus(T.exportDownloaded(format.toUpperCase()));
    } catch (error) {
      setStatus(errorText(error, T.unableToExport(format.toUpperCase())));
    } finally {
      setBusy(null);
    }
  };

  const safeDeckHtml = () => ensureUtf8Charset(sanitizePresentationHtml(resolvePresentationAssetUrls(renderedDraftHtml)));
  const downloadHtml = () => downloadBlob(new Blob([safeDeckHtml()], { type: HTML_FILE_TYPE }), 'mof-presentation.html');
  const openDeck = () => {
    const url = URL.createObjectURL(new Blob([safeDeckHtml()], { type: HTML_FILE_TYPE }));
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const slotSchemas = selectedSpecSlide?.metadata?.slots || {};
  const editableContent = Object.entries(selectedSpecSlide?.content || {}).filter(([key]) => {
    const slot = slotSchemas[key];
    return slot?.llm !== false || slot?.editable === true || !slot;
  });
  const compatibleTemplates = templateVariants.filter((variant) =>
    (variant.manifest.layout || '') === (selectedSpecSlide?.layout || selectedSpecSlide?.metadata?.layout || ''),
  );
  const activePalette = PALETTES.some((palette) => palette.id === draftSpec?.theme?.id)
    ? draftSpec!.theme!.id : 'mof_classic';

  return (
    <aside
      className={`presentation-viewer relative order-last hidden shrink-0 border-s border-[#D5D8DC] bg-[#EEF0F2] shadow-[-8px_0_24px_rgba(16,24,40,0.06)] ${isCollapsed ? 'w-12 lg:flex' : 'lg:grid grid-cols-[180px_minmax(300px,1fr)_320px] grid-rows-[56px_minmax(0,1fr)]'}`}
      style={isCollapsed ? undefined : { width }}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {!isCollapsed && (
        <div
          role="separator"
          aria-label={T.resizePanel}
          className="absolute z-20 h-full w-1 cursor-col-resize transition-colors hover:bg-[#C6A75D]"
          style={{ marginInlineStart: '-2px' }}
          onPointerDown={(event) => {
            event.preventDefault();
            resizingRef.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
        />
      )}
      {isCollapsed ? (
        <button type="button" className="flex h-full w-12 items-center justify-center text-[#667085] hover:bg-white" onClick={() => setIsCollapsed(false)} aria-label={T.expandPresentation}>
          {isArabic ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />}
        </button>
      ) : (
        <>
          <div className="col-span-3 row-start-1 flex h-14 items-center justify-between border-b border-[#D5D8DC] bg-white px-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[#101828]">{T.presentation}</h2>
                <p className="text-[11px] text-[#667085]">{T.deckSummary(slides.length, descriptor?.revision)}</p>
              </div>
              {history && (
                <div role="tablist" aria-label={T.presentation} className="flex rounded-lg bg-[#F2F4F7] p-0.5">
                  {(['slides', 'history'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab}
                      onClick={() => setActiveTab(tab)}
                      className={`rounded-md px-3 py-1 text-xs font-medium ${activeTab === tab ? 'bg-white text-[#101828] shadow-sm' : 'text-[#667085] hover:text-[#101828]'}`}
                    >
                      {tab === 'slides' ? T.slidesTab : T.historyTab}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {authorizedActions?.some(a => a.action === 'presentation.export' && a.payload?.format === 'pdf') && <button type="button" className="rounded-lg p-2 text-[#667085] hover:bg-[#F2F4F7]" title={T.downloadPdf} disabled={!descriptor || dirty || !!busy} onClick={() => void exportDeck('pdf')}><span className="text-[10px] font-semibold">PDF</span></button>}
              {authorizedActions?.some(a => a.action === 'presentation.export' && a.payload?.format === 'pptx') && <button type="button" className="rounded-lg p-2 text-[#667085] hover:bg-[#F2F4F7]" title={T.downloadPowerPoint} disabled={!descriptor || dirty || !!busy} onClick={() => void exportDeck('pptx')}><span className="text-[10px] font-semibold">PPTX</span></button>}
              {hasBackendAction(authorizedActions, 'presentation.reload') && <button type="button" className="rounded-lg p-2 text-[#667085] hover:bg-[#F2F4F7] disabled:opacity-40" title={T.reloadLatestRevision} disabled={!descriptor || dirty || !!busy} onClick={() => void reloadDeck()}><ArrowPathIcon className="h-4 w-4" /></button>}
              {hasBackendAction(authorizedActions, 'presentation.openTab') && <button type="button" className="rounded-lg p-2 text-[#667085] hover:bg-[#F2F4F7]" title={T.openInNewTab} onClick={openDeck}><ArrowsPointingOutIcon className="h-4 w-4" /></button>}
              <button type="button" className="rounded-lg p-2 text-[#667085] hover:bg-[#F2F4F7]" title={T.collapse} onClick={() => setIsCollapsed(true)}>{isArabic ? <ChevronLeftIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}</button>
              <button type="button" className="rounded-lg p-2 text-[#667085] hover:bg-[#F2F4F7]" title={T.close} onClick={onClose}><XMarkIcon className="h-5 w-5" /></button>
            </div>
          </div>

          {history && activeTab === 'history' && (
            <div className="absolute inset-x-0 bottom-0 top-14 z-30">
              <PresentationHistoryList
                isArabic={isArabic}
                accentColor={history.accentColor}
                activeDeckId={descriptor?.deckId}
                refreshKey={descriptor?.deckId}
                onOpenDeck={(deck) => {
                  history.onOpenDeck(deck);
                  setActiveTab('slides');
                }}
              />
            </div>
          )}

          {slides.length > 0 && (
            <div className="col-start-1 row-start-2 flex min-h-0 flex-col gap-2 overflow-hidden border-e border-[#D5D8DC] bg-[#F7F7F7] px-2 py-3">
              <h3 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-[#4B4F58]">{T.slides}</h3>
              <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" role="tablist" aria-label={T.slides}>
                {slides.map((slide) => (
                  <button key={`${slide.id || slide.number}-${slide.index}`} type="button" role="tab" aria-selected={slide.index === selectedIndex} title={slide.label}
                    className={`flex w-full items-start gap-2 rounded-md border-0 px-2 py-2 text-start text-xs ${slide.index === selectedIndex ? `bg-white text-[#232528] ${isArabic ? 'shadow-[inset_-3px_0_0_#92722A]' : 'shadow-[inset_3px_0_0_#92722A]'}` : 'bg-transparent text-[#4B4F58] hover:bg-[#E4E6E9]'}`}
                    onClick={() => scrollToSlide(slide.index)}>
                    <span className="w-5 shrink-0 font-bold text-[#7C5E24]">{slide.number}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate font-semibold">{slide.label}</b>
                      <small className="text-[10px] text-[#6B7079]">{T.slideNumber(slide.index + 1)}</small>
                    </span>
                  </button>
                ))}
              </div>
              <div className="border-t border-[#D5D8DC] pt-2">
                <p className="mb-2 truncate px-1 text-[11px] text-[#6B7079]" title={selectedSlide?.label}>{selectedSlide ? `${selectedSlide.number} · ${selectedSlide.label}` : T.selectSlide}</p>
                <div className="flex flex-wrap items-center gap-1">
                {hasBackendAction(authorizedActions, 'presentation.edit') && <button type="button" className="rounded-lg border border-[#D0D5DD] p-1.5 text-[#344054] disabled:opacity-40" title={T.moveUp} disabled={selectedIndex <= 0 || !!busy || dirty} onClick={() => mutateSlides('up')}><ChevronUpIcon className="h-3.5 w-3.5" /></button>}
                {hasBackendAction(authorizedActions, 'presentation.edit') && <button type="button" className="rounded-lg border border-[#D0D5DD] p-1.5 text-[#344054] disabled:opacity-40" title={T.moveDown} disabled={selectedIndex >= slides.length - 1 || !!busy || dirty} onClick={() => mutateSlides('down')}><ChevronDownIcon className="h-3.5 w-3.5" /></button>}
                {hasBackendAction(authorizedActions, 'presentation.edit') && <button type="button" className="rounded-lg border border-[#FDA29B] p-1.5 text-[#B42318] disabled:opacity-40" title={T.delete} disabled={slides.length < 2 || !!busy || dirty} onClick={() => mutateSlides('delete')}><TrashIcon className="h-3.5 w-3.5" /></button>}
                {hasBackendAction(authorizedActions, 'presentation.downloadHtml') && <button type="button" className="ms-auto inline-flex items-center gap-1 rounded-lg border border-[#C6A75D] px-2 py-1.5 text-xs font-medium text-[#8A6D2F]" onClick={downloadHtml}><ArrowDownTrayIcon className="h-3.5 w-3.5" />HTML</button>}
                </div>
                {hasBackendAction(authorizedActions, 'presentation.edit') && <button type="button" className="mt-2 w-full rounded-md border border-[#92722A] bg-[#92722A] px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-40" disabled={!selectedSpecSlide || !!busy || dirty} onClick={addSlide}>{T.addSlide}</button>}
              </div>
            </div>
          )}

          <div className="col-start-2 row-start-2 flex min-h-0 min-w-0 flex-col bg-[#EEF0F2]">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[#D5D8DC] bg-white px-3">
              <input aria-label={T.presentationTitle} className="min-w-0 flex-1 rounded-md border border-[#D5D8DC] bg-white px-2 py-1 text-xs font-semibold text-[#232528]" value={draftSpec?.title || ''} disabled={!hasBackendAction(authorizedActions, 'presentation.edit') || !draftSpec || !!busy} onChange={(event) => changeTitle(event.target.value)} />
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${dirty ? 'bg-[#F6F1E2] font-semibold text-[#7C5E24]' : 'bg-[#EEF0F2] text-[#4B4F58]'}`}>{dirty ? T.unsaved : descriptor ? T.revision(descriptor.revision) : T.preview}</span>
              {hasBackendAction(authorizedActions, 'presentation.save') && <button type="button" className="rounded-md bg-[#92722A] px-3 py-1 text-xs font-semibold text-white disabled:opacity-40" disabled={!dirty || !!busy || !draftSpec} onClick={() => draftSpec && void saveSpec(draftSpec, null, T.deckSaved)}>{T.save}</button>}
            </div>
            <div
              ref={previewStageRef}
              className="min-h-0 flex-1 overflow-y-auto p-3"
              onScroll={(event) => {
                if (!preview.fixedCanvas || !preview.slideCount) return;
                const stage = event.currentTarget;
                const step = (SLIDE_HEIGHT + SLIDE_GAP) * previewScale;
                const index = Math.min(preview.slideCount - 1, Math.floor((stage.scrollTop + 16) / step));
                setSelectedIndex(index);
              }}
            >
              {preview.fixedCanvas ? (
                <div className="relative mx-auto" style={{ width: SLIDE_WIDTH * previewScale, height: (preview.slideCount * SLIDE_HEIGHT + Math.max(0, preview.slideCount - 1) * SLIDE_GAP) * previewScale }}>
                  <iframe ref={previewFrameRef} onLoad={handlePreviewLoad} title={T.previewFrameTitle} className="absolute left-0 top-0 border-0 bg-transparent" style={{ width: SLIDE_WIDTH, height: preview.slideCount * SLIDE_HEIGHT + Math.max(0, preview.slideCount - 1) * SLIDE_GAP, transform: `scale(${previewScale})`, transformOrigin: 'top left' }} sandbox="allow-same-origin" srcDoc={preview.html} />
                </div>
              ) : (
                <iframe ref={previewFrameRef} onLoad={handlePreviewLoad} title={T.previewFrameTitle} className="h-full w-full border border-[#D5D8DC] bg-white shadow-sm" sandbox="allow-same-origin" srcDoc={preview.html} />
              )}
            </div>
          </div>

          <div className="col-start-3 row-start-2 min-h-0 overflow-y-auto border-s border-[#D5D8DC] bg-white p-3">
            <h3 className="mb-3 border-b border-[#E4E6E9] pb-2 text-xs font-semibold text-[#4B4F58]">{T.slideInspector}</h3>
            {busy && <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#FFFCF5] px-3 py-2 text-xs text-[#8A6D2F]"><ArrowPathIcon className="h-4 w-4 animate-spin" />{busy}</div>}
            {status && <p className="mb-2 rounded-lg bg-[#F2F4F7] px-3 py-2 text-xs text-[#475467]">{status}</p>}

            {selectedSpecSlide && hasBackendAction(authorizedActions, 'presentation.edit') ? (
              <>
                <div className="mb-3 rounded-lg border border-[#D5D8DC] bg-[#F7F7F7] p-2.5">
                  <label className="block text-[11px] font-semibold text-[#4B4F58]">{T.design}</label>
                  <select className="mt-1 w-full rounded-md border border-[#D5D8DC] bg-white px-2 py-1.5 text-xs" value={`${selectedSpecSlide.template.id}@${selectedSpecSlide.template.version}`} disabled={!compatibleTemplates.length || !!busy || dirty} onChange={(event) => switchTemplate(event.target.value)}>
                    {compatibleTemplates.length ? compatibleTemplates.map((variant) => <option key={variant.ref} value={variant.ref}>{variant.name}</option>) : <option value={`${selectedSpecSlide.template.id}@${selectedSpecSlide.template.version}`}>{selectedSpecSlide.template.id}</option>}
                  </select>
                  <label htmlFor="presentation-deck-palette" className="mt-2 block text-[11px] font-semibold text-[#4B4F58]">{T.deckPalette}</label>
                  <select id="presentation-deck-palette" className="mt-1 w-full rounded-md border border-[#D5D8DC] bg-white px-2 py-1.5 text-xs" value={activePalette} disabled={!!busy} onChange={(event) => changeDeckPalette(event.target.value as PresentationPalette)}>
                    {PALETTES.map((palette) => <option key={palette.id} value={palette.id}>{T.palettes[palette.id]}</option>)}
                  </select>
                  <div className="mt-3 border-t border-[#D5D8DC] pt-2">
                    <label htmlFor="presentation-accent-hex" className="block text-[11px] font-semibold text-[#4B4F58]">{T.accentHex}</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input aria-label={T.pickAccent} type="color" className="h-8 w-9 cursor-pointer rounded border border-[#D5D8DC] bg-white p-0.5" value={/^#[0-9a-f]{6}$/i.test(accentInput) ? accentInput : '#B79A55'} disabled={!!busy} onChange={(event) => changeAccentHex(event.target.value)} />
                      <input id="presentation-accent-hex" type="text" dir="ltr" inputMode="text" maxLength={7} spellCheck={false} className="min-w-0 flex-1 rounded-md border border-[#D5D8DC] bg-white px-2 py-1.5 font-mono text-xs uppercase" value={accentInput} disabled={!!busy} onChange={(event) => changeAccentHex(event.target.value)} aria-invalid={!/^#[0-9a-f]{6}$/i.test(accentInput)} placeholder="#B79A55" />
                    </div>
                    {!/^#[0-9a-f]{6}$/i.test(accentInput) && <p className="mt-1 text-[10px] text-[#B42318]">{T.invalidHex}</p>}
                    <div className="mt-2 grid grid-cols-2 gap-1" role="group" aria-label={T.applyAccentTo}>
                      <button type="button" className={`rounded-md border px-2 py-1 text-[11px] font-medium ${accentScope === 'slide' ? 'border-[#92722A] bg-[#F6F1E2] text-[#7C5E24]' : 'border-[#D5D8DC] bg-white text-[#4B4F58]'}`} disabled={!!busy} aria-pressed={accentScope === 'slide'} onClick={() => setAccentScope('slide')}>{T.thisSlide}</button>
                      <button type="button" className={`rounded-md border px-2 py-1 text-[11px] font-medium ${accentScope === 'deck' ? 'border-[#92722A] bg-[#F6F1E2] text-[#7C5E24]' : 'border-[#D5D8DC] bg-white text-[#4B4F58]'}`} disabled={!!busy} aria-pressed={accentScope === 'deck'} onClick={() => setAccentScope('deck')}>{T.allSlides}</button>
                    </div>
                    <p className="mt-1 text-[10px] text-[#667085]">{T.accentHint}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-semibold text-[#4B4F58]">{T.background}
                      <select className="mt-1 w-full rounded-md border border-[#D5D8DC] bg-white px-1.5 py-1 text-xs font-normal" value={String(selectedSpecSlide.background || 'light')} disabled={!!busy} onChange={(event) => changeSlideDesign('background', event.target.value)}>
                        <option value="light">{T.backgrounds.light}</option><option value="tint">{T.backgrounds.tint}</option><option value="silver">{T.backgrounds.silver}</option><option value="dark">{T.backgrounds.dark}</option><option value="accent">{draftSpec?.theme?.id === 'national' ? T.backgrounds.black : T.backgrounds.gold}</option>
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold text-[#4B4F58]">{T.pattern}
                      <select className="mt-1 w-full rounded-md border border-[#D5D8DC] bg-white px-1.5 py-1 text-xs font-normal" value={String(selectedSpecSlide.pattern || 'none')} disabled={!!busy} onChange={(event) => changeSlideDesign('pattern', event.target.value)}>
                        <option value="none">{T.patterns.none}</option><option value="tr">{T.patterns.tr}</option><option value="br">{T.patterns.br}</option><option value="tl">{T.patterns.tl}</option><option value="bl">{T.patterns.bl}</option><option value="r">{T.patterns.r}</option><option value="l">{T.patterns.l}</option>
                      </select>
                    </label>
                  </div>
                  <button type="button" className="mt-2 w-full rounded-md border border-[#D5D8DC] bg-white px-2 py-1.5 text-xs font-medium text-[#4B4F58] disabled:opacity-40" disabled={!!busy} onClick={shuffleDesign}>{T.shuffleDesign}</button>
                </div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-[#101828]">{T.editSlideContent}</h3>
                    <p className="text-[10px] text-[#98A2B3]">{T.editSlideContentHint}</p>
                  </div>
                  {hasBackendAction(authorizedActions, 'presentation.save') && <button type="button" className="inline-flex items-center gap-1 rounded-lg bg-[#101828] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40" disabled={!dirty || !!busy} onClick={() => draftSpec && void saveSpec(draftSpec, null, T.contentSaved)}><CheckIcon className="h-3.5 w-3.5" />{T.save}</button>}
                </div>
                <div className="space-y-3">
                  {editableContent.map(([key, value]) => (
                    <ValueEditor key={key} label={key} value={value} schema={slotSchemas[key]} text={T} onChange={(next) => updateSelectedContent(key, next)} />
                  ))}
                </div>
                <div className="mt-4 border-t border-[#EAECF0] pt-3">
                  <label className="block text-[11px] font-medium text-[#475467]">{T.aiInstruction}</label>
                  <textarea className="mt-1 w-full rounded-lg border border-[#D0D5DD] px-2 py-1.5 text-xs" rows={2} maxLength={300} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder={T.aiInstructionPlaceholder} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {hasBackendAction(authorizedActions, 'presentation.regenerateSlide') && <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-[#C6A75D] bg-[#FFFCF5] px-3 py-1.5 text-xs font-medium text-[#8A6D2F] disabled:opacity-40" disabled={!descriptor || dirty || !!busy || !!proposal} onClick={() => void regenerate()}><ArrowPathIcon className="h-3.5 w-3.5" />{T.regenerateSlide}</button>}
                    {hasBackendAction(authorizedActions, 'presentation.regenerateDeck') && <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-medium text-[#344054] disabled:opacity-40" disabled={!descriptor || dirty || !!busy || !!proposal} onClick={() => void regenerateDeck()}><ArrowPathIcon className="h-3.5 w-3.5" />{T.regenerateDeck}</button>}
                  </div>
                  {proposal && (
                    <div className="mt-3 rounded-lg border border-[#C6A75D] bg-[#FFFCF5] p-2">
                      <p className="text-xs text-[#8A6D2F]">{T.proposalReady(proposal.scope)}</p>
                      <div className="mt-2 flex gap-2">
                        {hasBackendAction(authorizedActions, 'presentation.save') && <button type="button" className="rounded-lg bg-[#101828] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40" disabled={!!busy} onClick={() => void keepProposal()}><CheckIcon className="me-1 inline h-3.5 w-3.5" />{T.keepAndSave}</button>}
                        <button type="button" className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs text-[#344054] disabled:opacity-40" disabled={!!busy} onClick={() => { setProposal(null); setStatus(T.proposalDiscarded); }}>{T.discard}</button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 border-t border-[#E4E6E9] pt-3">
                  <h4 className="text-xs font-semibold text-[#232528]">{T.changeHistory}</h4>
                  {changes.length ? (
                    <ul className="mt-1 divide-y divide-[#E4E6E9]">
                      {changes.slice(0, 8).map((change) => (
                        <li key={`${change.revision}-${change.createdAt || ''}`} className="py-2 text-[11px] text-[#4B4F58]">
                          <div className="flex items-center justify-between gap-2"><b>{T.revision(change.revision)}</b><span className="text-[#6B7079]">{change.source || T.changeSourceFallback}</span></div>
                          <p className="mt-0.5">{change.summary || T.changeSummaryFallback}</p>
                          {change.createdAt ? <small className="text-[10px] text-[#6B7079]">{new Date(change.createdAt).toLocaleString(T.dateLocale)}{change.changedBy ? ` · ${change.changedBy}` : ''}</small> : null}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-[11px] text-[#6B7079]">{T.noChanges}</p>}
                </div>
              </>
            ) : (
              <p className="text-xs text-[#667085]">{T.noMetadata}</p>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
