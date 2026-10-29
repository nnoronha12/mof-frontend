// User-facing labels for PresentationViewer, in English and Arabic.
// Deck content, slot names from templates, file-format names (PDF, PPTX, HTML)
// and hex codes are not translated.

export interface PresentationViewerText {
  // Header
  presentation: string;
  slidesTab: string;
  historyTab: string;
  deckSummary: (slideCount: number, revision?: number) => string;
  downloadPdf: string;
  downloadPowerPoint: string;
  reloadLatestRevision: string;
  openInNewTab: string;
  collapse: string;
  expandPresentation: string;
  close: string;
  resizePanel: string;
  // Slide list
  slides: string;
  slideNumber: (number: number) => string;
  selectSlide: string;
  moveUp: string;
  moveDown: string;
  delete: string;
  addSlide: string;
  // Preview toolbar
  presentationTitle: string;
  unsaved: string;
  revision: (revision: number) => string;
  preview: string;
  save: string;
  previewFrameTitle: string;
  // Inspector
  slideInspector: string;
  design: string;
  deckPalette: string;
  palettes: Record<'mof_classic' | 'sapphire' | 'uae_red' | 'national', string>;
  accentHex: string;
  pickAccent: string;
  invalidHex: string;
  applyAccentTo: string;
  thisSlide: string;
  allSlides: string;
  accentHint: string;
  background: string;
  backgrounds: { light: string; tint: string; silver: string; dark: string; gold: string; black: string };
  pattern: string;
  patterns: { none: string; tr: string; br: string; tl: string; bl: string; r: string; l: string };
  shuffleDesign: string;
  editSlideContent: string;
  editSlideContentHint: string;
  aiInstruction: string;
  aiInstructionPlaceholder: string;
  regenerateSlide: string;
  regenerateDeck: string;
  proposalReady: (scope: 'slide' | 'deck') => string;
  keepAndSave: string;
  discard: string;
  changeHistory: string;
  changeSourceFallback: string;
  changeSummaryFallback: string;
  noChanges: string;
  noMetadata: string;
  dateLocale: string | undefined;
  // Value editor
  addItem: string;
  removeItem: string;
  removeItemAria: (label: string, number: number) => string;
  // Busy and status messages
  loadingDeck: string;
  unableToLoadDeck: string;
  unableToLoadDesigns: (detail: string) => string;
  unableToLoadTemplates: string;
  saved: string;
  localOnly: string;
  saving: string;
  savedWithRevision: (message: string, revision: number) => string;
  unableToSave: string;
  slideDeleted: string;
  slidesReordered: string;
  unsavedPalette: string;
  unsavedAccent: (allSlides: boolean, slideNumber: number) => string;
  unsavedSlideField: (field: 'background' | 'pattern') => string;
  unsavedShuffle: string;
  unsavedTitle: string;
  slideAdded: string;
  slideDesignChanged: string;
  reloading: string;
  reloaded: string;
  unableToReload: string;
  unsavedContent: string;
  regeneratingSlide: string;
  slideProposalStatus: string;
  unableToRegenerateSlide: string;
  regeneratingDeck: string;
  deckProposalStatus: string;
  unableToRegenerateDeck: string;
  deckRegenerated: string;
  slideRegenerated: string;
  preparingExport: (format: string) => string;
  exportDownloaded: (format: string) => string;
  unableToExport: (format: string) => string;
  deckSaved: string;
  contentSaved: string;
  proposalDiscarded: string;
}

const en: PresentationViewerText = {
  presentation: 'Presentation',
  slidesTab: 'Slides',
  historyTab: 'History',
  deckSummary: (slideCount, revision) => `${slideCount} slides${revision !== undefined ? ` · revision ${revision}` : ''}`,
  downloadPdf: 'Download PDF',
  downloadPowerPoint: 'Download PowerPoint',
  reloadLatestRevision: 'Reload latest revision',
  openInNewTab: 'Open in new tab',
  collapse: 'Collapse',
  expandPresentation: 'Expand presentation',
  close: 'Close',
  resizePanel: 'Resize presentation panel',
  slides: 'Slides',
  slideNumber: (number) => `Slide ${number}`,
  selectSlide: 'Select a slide',
  moveUp: 'Move up',
  moveDown: 'Move down',
  delete: 'Delete',
  addSlide: '+ Add slide',
  presentationTitle: 'Presentation title',
  unsaved: 'Unsaved',
  revision: (revision) => `Revision ${revision}`,
  preview: 'Preview',
  save: 'Save',
  previewFrameTitle: 'Scrollable presentation preview',
  slideInspector: 'Slide inspector',
  design: 'Design',
  deckPalette: 'Deck palette',
  palettes: { mof_classic: 'MOF Classic', sapphire: 'Sapphire', uae_red: 'UAE Red', national: 'National' },
  accentHex: 'Accent colour · hex',
  pickAccent: 'Pick accent colour',
  invalidHex: 'Enter a six-digit hex code, such as #B79A55.',
  applyAccentTo: 'Apply accent colour to',
  thisSlide: 'This slide',
  allSlides: 'All slides',
  accentHint: 'Changes appear in the preview. Save to update the deck.',
  background: 'Background',
  backgrounds: { light: 'White', tint: 'Silver tint', silver: 'Silver', dark: 'Iron', gold: 'Gold', black: 'Black' },
  pattern: 'Pattern',
  patterns: { none: 'None', tr: 'Top right', br: 'Bottom right', tl: 'Top left', bl: 'Bottom left', r: 'Right edge', l: 'Left edge' },
  shuffleDesign: 'Shuffle deck design',
  editSlideContent: 'Edit slide content',
  editSlideContentHint: 'Text, tables, and chart values',
  aiInstruction: 'AI regeneration instruction',
  aiInstructionPlaceholder: 'Optional: make this more executive, update the table, simplify the message…',
  regenerateSlide: 'Regenerate slide',
  regenerateDeck: 'Regenerate deck',
  proposalReady: (scope) => `${scope === 'deck' ? 'Full deck proposal ready.' : 'Slide proposal ready.'} Nothing is saved until you keep it.`,
  keepAndSave: 'Keep and save',
  discard: 'Discard',
  changeHistory: 'Change history',
  changeSourceFallback: 'edit',
  changeSummaryFallback: 'Presentation updated',
  noChanges: 'No saved changes yet.',
  noMetadata: 'The rendered deck is available. Backend slide metadata is required for content editing and AI regeneration.',
  dateLocale: undefined,
  addItem: '+ Add item',
  removeItem: 'Remove item',
  removeItemAria: (label, number) => `Remove ${label} item ${number}`,
  loadingDeck: 'Loading deck…',
  unableToLoadDeck: 'Unable to load deck',
  unableToLoadDesigns: (detail) => `Unable to load slide designs: ${detail}`,
  unableToLoadTemplates: 'Unable to load slide templates',
  saved: 'Saved',
  localOnly: 'This deck has no backend deck ID yet; changes are local only.',
  saving: 'Saving…',
  savedWithRevision: (message, revision) => `${message} · revision ${revision}`,
  unableToSave: 'Unable to save presentation',
  slideDeleted: 'Slide deleted',
  slidesReordered: 'Slides reordered',
  unsavedPalette: 'Unsaved deck colour change',
  unsavedAccent: (allSlides, slideNumber) => `Unsaved accent colour · ${allSlides ? 'all slides' : `slide ${slideNumber}`}`,
  unsavedSlideField: (field) => `Unsaved slide ${field} change`,
  unsavedShuffle: 'Unsaved shuffled deck design',
  unsavedTitle: 'Unsaved title change',
  slideAdded: 'Slide added',
  slideDesignChanged: 'Slide design changed',
  reloading: 'Reloading…',
  reloaded: 'Reloaded latest revision',
  unableToReload: 'Unable to reload deck',
  unsavedContent: 'Unsaved content changes',
  regeneratingSlide: 'Regenerating slide…',
  slideProposalStatus: 'Slide proposal ready. Keep and save it, or discard it.',
  unableToRegenerateSlide: 'Unable to regenerate slide',
  regeneratingDeck: 'Regenerating deck…',
  deckProposalStatus: 'Deck proposal ready. Keep and save it, or discard it.',
  unableToRegenerateDeck: 'Unable to regenerate deck',
  deckRegenerated: 'Deck regenerated',
  slideRegenerated: 'Slide regenerated',
  preparingExport: (format) => `Preparing ${format}…`,
  exportDownloaded: (format) => `${format} downloaded`,
  unableToExport: (format) => `Unable to export ${format}`,
  deckSaved: 'Deck saved',
  contentSaved: 'Content saved',
  proposalDiscarded: 'Proposal discarded.',
};

const ar: PresentationViewerText = {
  presentation: 'العرض التقديمي',
  slidesTab: 'الشرائح',
  historyTab: 'السجل',
  deckSummary: (slideCount, revision) => `عدد الشرائح: ${slideCount}${revision !== undefined ? ` · المراجعة ${revision}` : ''}`,
  downloadPdf: 'تنزيل ملف PDF',
  downloadPowerPoint: 'تنزيل ملف PowerPoint',
  reloadLatestRevision: 'إعادة تحميل أحدث مراجعة',
  openInNewTab: 'فتح في علامة تبويب جديدة',
  collapse: 'طي',
  expandPresentation: 'توسيع العرض التقديمي',
  close: 'إغلاق',
  resizePanel: 'تغيير حجم لوحة العرض التقديمي',
  slides: 'الشرائح',
  slideNumber: (number) => `الشريحة ${number}`,
  selectSlide: 'اختر شريحة',
  moveUp: 'نقل إلى الأعلى',
  moveDown: 'نقل إلى الأسفل',
  delete: 'حذف',
  addSlide: '+ إضافة شريحة',
  presentationTitle: 'عنوان العرض التقديمي',
  unsaved: 'غير محفوظ',
  revision: (revision) => `المراجعة ${revision}`,
  preview: 'معاينة',
  save: 'حفظ',
  previewFrameTitle: 'معاينة العرض التقديمي القابلة للتمرير',
  slideInspector: 'خصائص الشريحة',
  design: 'التصميم',
  deckPalette: 'لوحة ألوان العرض',
  palettes: { mof_classic: 'وزارة المالية (كلاسيكي)', sapphire: 'الياقوت الأزرق', uae_red: 'أحمر الإمارات', national: 'الوطني' },
  accentHex: 'لون التمييز · الرمز السداسي',
  pickAccent: 'اختيار لون التمييز',
  invalidHex: 'أدخل رمزًا سداسيًا من ستة أحرف، مثل #B79A55.',
  applyAccentTo: 'تطبيق لون التمييز على',
  thisSlide: 'هذه الشريحة',
  allSlides: 'جميع الشرائح',
  accentHint: 'تظهر التغييرات في المعاينة. احفظ لتحديث العرض.',
  background: 'الخلفية',
  backgrounds: { light: 'أبيض', tint: 'فضي فاتح', silver: 'فضي', dark: 'حديدي', gold: 'ذهبي', black: 'أسود' },
  pattern: 'الزخرفة',
  patterns: { none: 'بدون', tr: 'أعلى اليمين', br: 'أسفل اليمين', tl: 'أعلى اليسار', bl: 'أسفل اليسار', r: 'الحافة اليمنى', l: 'الحافة اليسرى' },
  shuffleDesign: 'تبديل تصميم العرض عشوائيًا',
  editSlideContent: 'تعديل محتوى الشريحة',
  editSlideContentHint: 'النصوص والجداول وقيم الرسوم البيانية',
  aiInstruction: 'تعليمات إعادة الإنشاء بالذكاء الاصطناعي',
  aiInstructionPlaceholder: 'اختياري: اجعلها أنسب للإدارة العليا، أو حدّث الجدول، أو بسّط الرسالة…',
  regenerateSlide: 'إعادة إنشاء الشريحة',
  regenerateDeck: 'إعادة إنشاء العرض',
  proposalReady: (scope) => `${scope === 'deck' ? 'مقترح العرض الكامل جاهز.' : 'مقترح الشريحة جاهز.'} لن يُحفظ أي تغيير ما لم تعتمده.`,
  keepAndSave: 'اعتماد وحفظ',
  discard: 'تجاهل',
  changeHistory: 'سجل التغييرات',
  changeSourceFallback: 'تعديل',
  changeSummaryFallback: 'تم تحديث العرض التقديمي',
  noChanges: 'لا توجد تغييرات محفوظة بعد.',
  noMetadata: 'العرض متاح للمعاينة. يلزم توفر بيانات الشرائح من الخادم لتعديل المحتوى وإعادة الإنشاء بالذكاء الاصطناعي.',
  dateLocale: 'ar-AE',
  addItem: '+ إضافة عنصر',
  removeItem: 'إزالة العنصر',
  removeItemAria: (label, number) => `إزالة العنصر ${number} من ${label}`,
  loadingDeck: 'جارٍ تحميل العرض…',
  unableToLoadDeck: 'تعذّر تحميل العرض',
  unableToLoadDesigns: () => 'تعذّر تحميل تصاميم الشرائح',
  unableToLoadTemplates: 'تعذّر تحميل قوالب الشرائح',
  saved: 'تم الحفظ',
  localOnly: 'لا يحمل هذا العرض معرّفًا على الخادم بعد؛ التغييرات محلية فقط.',
  saving: 'جارٍ الحفظ…',
  savedWithRevision: (message, revision) => `${message} · المراجعة ${revision}`,
  unableToSave: 'تعذّر حفظ العرض التقديمي',
  slideDeleted: 'تم حذف الشريحة',
  slidesReordered: 'تمت إعادة ترتيب الشرائح',
  unsavedPalette: 'تغيير ألوان العرض غير محفوظ',
  unsavedAccent: (allSlides, slideNumber) => `لون التمييز غير محفوظ · ${allSlides ? 'جميع الشرائح' : `الشريحة ${slideNumber}`}`,
  unsavedSlideField: (field) => (field === 'background' ? 'تغيير خلفية الشريحة غير محفوظ' : 'تغيير زخرفة الشريحة غير محفوظ'),
  unsavedShuffle: 'التصميم العشوائي للعرض غير محفوظ',
  unsavedTitle: 'تغيير العنوان غير محفوظ',
  slideAdded: 'تمت إضافة شريحة',
  slideDesignChanged: 'تم تغيير تصميم الشريحة',
  reloading: 'جارٍ إعادة التحميل…',
  reloaded: 'تمت إعادة تحميل أحدث مراجعة',
  unableToReload: 'تعذّرت إعادة تحميل العرض',
  unsavedContent: 'تغييرات المحتوى غير محفوظة',
  regeneratingSlide: 'جارٍ إعادة إنشاء الشريحة…',
  slideProposalStatus: 'مقترح الشريحة جاهز. اعتمده واحفظه، أو تجاهله.',
  unableToRegenerateSlide: 'تعذّرت إعادة إنشاء الشريحة',
  regeneratingDeck: 'جارٍ إعادة إنشاء العرض…',
  deckProposalStatus: 'مقترح العرض جاهز. اعتمده واحفظه، أو تجاهله.',
  unableToRegenerateDeck: 'تعذّرت إعادة إنشاء العرض',
  deckRegenerated: 'تمت إعادة إنشاء العرض',
  slideRegenerated: 'تمت إعادة إنشاء الشريحة',
  preparingExport: (format) => `جارٍ تجهيز ملف ${format}…`,
  exportDownloaded: (format) => `تم تنزيل ملف ${format}`,
  unableToExport: (format) => `تعذّر تصدير ملف ${format}`,
  deckSaved: 'تم حفظ العرض',
  contentSaved: 'تم حفظ المحتوى',
  proposalDiscarded: 'تم تجاهل المقترح.',
};

export const PRESENTATION_VIEWER_TEXT: { en: PresentationViewerText; ar: PresentationViewerText } = { en, ar };
