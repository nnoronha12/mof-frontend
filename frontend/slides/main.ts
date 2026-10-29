import '@fontsource/inter/200.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/600.css';
import '@fontsource/roboto/700.css';
import '@fontsource/alexandria/600.css';
import '@fontsource/alexandria/400.css';
import '@fontsource/alexandria/700.css';
import '@fontsource/alexandria/800.css';
import '@fontsource/noto-kufi-arabic/300.css';
import '@fontsource/noto-kufi-arabic/400.css';
import '@fontsource/noto-kufi-arabic/500.css';
import '@fontsource/noto-kufi-arabic/600.css';
import '@fontsource/noto-kufi-arabic/700.css';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import PptxGenJS from 'pptxgenjs';
import './styles.css';

type Locale = 'en' | 'ar';
type SlideType = 'cover' | 'section' | 'bullets' | 'two_col' | 'stats' | 'table' | 'chart' | 'quote' | 'closing';
type SlideTheme = 'white_gold' | 'black_gold' | 'gold_white';
type Localized = { en: string; ar: string };
type SlideDefinition = { id: string; type: SlideType; variant: number; label: Localized; render: (locale: Locale, theme?: SlideTheme) => string };

const englishLogoPath = '/mof-logo-en-trim.png';
const arabicLogoPath = '/UAE_MOF_brandmark_arabic-transparent.png';
let logoPath = englishLogoPath;
const logoFor = (locale: Locale) => locale === 'ar' ? arabicLogoPath : englishLogoPath;
// Trimmed to the visible mark so it sits exactly on the cover margin.
const coverLogoFor = (locale: Locale) => locale === 'ar' ? '/mof-logo-ar-trim.png' : '/mof-logo-en-trim.png';
const slideTypes: SlideType[] = ['cover', 'section', 'bullets', 'two_col', 'stats', 'table', 'chart', 'quote', 'closing'];
const tx = (en: string, ar: string): Localized => ({ en, ar });
const t = (value: Localized, locale: Locale) => value[locale];
const num = (value: number, locale: Locale) => new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-AE').format(value);
const typeLabels: Record<SlideType | 'all', Localized> = {
  all: tx('All', 'الكل'), cover: tx('Cover', 'الغلاف'), section: tx('Section', 'القسم'), bullets: tx('Bullets', 'النقاط'),
  two_col: tx('Two column', 'عمودان'), stats: tx('Stats', 'الإحصاءات'), table: tx('Table', 'الجدول'),
  chart: tx('Chart', 'الرسم البياني'), quote: tx('Quote', 'الاقتباس'), closing: tx('Closing', 'الختام'),
};
const themeLabels: Record<SlideTheme, Localized> = {
  white_gold: tx('White and gold', 'الأبيض والذهبي'),
  black_gold: tx('Black and gold', 'الأسود والذهبي'),
  gold_white: tx('Gold and white', 'الذهبي والأبيض'),
};
const selectableThemes: SlideTheme[] = ['white_gold', 'black_gold', 'gold_white'];

const icon = (name: 'spark' | 'chart' | 'flow' | 'shield' | 'flag' | 'arrow' | 'check') => {
  const paths = {
    spark: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
    chart: '<path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-6"/><path d="M16 7h3v3"/>',
    flow: '<rect x="3" y="4" width="6" height="6" rx="1"/><rect x="15" y="14" width="6" height="6" rx="1"/><path d="M9 7h4a4 4 0 0 1 4 4v3"/><path d="m14 11 3 3 3-3"/>',
    shield: '<path d="M12 3l7 3v5c0 4.8-2.9 8.3-7 10-4.1-1.7-7-5.2-7-10V6l7-3Z"/><path d="m9 12 2 2 4-5"/>',
    flag: '<path d="M5 21V4m0 1h11l-2 4 2 4H5"/>', arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  };
  return `<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
};

const content = {
  cover: [
    [tx('Presentation title goes here', 'يُكتب عنوان العرض هنا'), tx('A concise subtitle that explains the purpose, audience, and intended outcome.', 'عنوان فرعي موجز يوضح الغرض والجمهور والنتيجة المرجوة.')],
    [tx('Building resilient public finance', 'بناء مالية عامة مرنة'), tx('A strategic briefing for confident, evidence-led decisions.', 'إحاطة استراتيجية لاتخاذ قرارات واثقة قائمة على الأدلة.')],
    [tx('The year ahead', 'العام المقبل'), tx('Priorities, outcomes, and the path from ambition to delivery.', 'الأولويات والنتائج والمسار من الطموح إلى التنفيذ.')],
    [tx('One direction. Shared impact.', 'توجه واحد. أثر مشترك.'), tx('A ministry-wide view of the opportunity before us.', 'رؤية شاملة للفرصة المتاحة أمام الوزارة.')],
    [tx('2026 policy outlook', 'آفاق السياسات ٢٠٢٦'), tx('Signals shaping the next chapter of federal finance.', 'مؤشرات ترسم الفصل المقبل للمالية الاتحادية.')],
  ],
  section: [
    [tx('A focused statement introduces the chapter', 'عبارة مركزة تقدم هذا الفصل'), tx('One sentence frames the question this section will answer.', 'جملة واحدة تحدد السؤال الذي سيجيب عنه هذا القسم.')],
    [tx('Understand the opportunity', 'فهم الفرصة'), tx('Start with the evidence that matters most.', 'ابدأ بالأدلة الأكثر أهمية.')],
    [tx('From insight to action', 'من الرؤية إلى العمل'), tx('Translate the finding into a practical direction.', 'حوّل النتيجة إلى توجه عملي.')],
    [tx('Deliver with confidence', 'التنفيذ بثقة'), tx('Clarify ownership, timing, and measures of success.', 'وضّح المسؤولية والتوقيت ومقاييس النجاح.')],
    [tx('The decision ahead', 'القرار المقبل'), tx('Focus on the choice that unlocks progress.', 'ركّز على الخيار الذي يفتح باب التقدم.')],
  ],
  bullets: [
    [tx('', ''), tx('Today’s conversation', 'محاور العرض اليوم'), [tx('Context and opportunity','السياق والفرصة'),tx('Evidence and insight','الأدلة والرؤى'),tx('Proposed direction','التوجه المقترح'),tx('Delivery roadmap','خارطة طريق التنفيذ'),tx('Delivery readiness','جاهزية التنفيذ'),tx('Decision and next steps','القرار والخطوات التالية')]],
    [tx('', ''), tx('Four priorities focus the work', 'أربع أولويات تركز العمل'), [tx('Simplify the user journey','تبسيط رحلة المستخدم'),tx('Connect trusted data','ربط البيانات الموثوقة'),tx('Strengthen accountability','تعزيز المساءلة'),tx('Measure public value','قياس القيمة العامة')]],
    [tx('', ''), tx('Principles guiding delivery', 'المبادئ الموجهة للتنفيذ'), [tx('Design around real needs','التصميم حول الاحتياجات الفعلية'),tx('Use evidence at every gate','استخدام الأدلة في كل مرحلة'),tx('Build once and reuse','البناء مرة وإعادة الاستخدام')]],
    [tx('', ''), tx('What happens next', 'ما الذي سيحدث تالياً'), [tx('Confirm scope and measures','تأكيد النطاق والمقاييس'),tx('Validate with users','التحقق مع المستخدمين'),tx('Assign accountable owners','تحديد المسؤولين'),tx('Launch the first delivery wave','إطلاق موجة التنفيذ الأولى'),tx('Review, learn, and improve','المراجعة والتعلم والتحسين')]],
    [tx('', ''), tx('Three moves unlock momentum', 'ثلاث خطوات تطلق الزخم'), [tx('Approve the shared direction','اعتماد التوجه المشترك'),tx('Fund the first delivery wave','تمويل موجة التنفيذ الأولى'),tx('Review outcomes after 90 days','مراجعة النتائج بعد ٩٠ يوماً')]],
  ],
  twoCol: [
    [tx('',''),tx('Move from fragmented to connected','الانتقال من التجزؤ إلى الترابط'),tx('Today','اليوم'),tx('Tomorrow','غداً')],
    [tx('',''),tx('Two paths, one clear choice','مساران وخيار واحد واضح'),tx('Option A','الخيار أ'),tx('Option B · Recommended','الخيار ب · موصى به')],
    [tx('',''),tx('Answer the barrier directly','معالجة العائق مباشرة'),tx('The barrier','العائق'),tx('Our response','استجابتنا')],
    [tx('',''),tx('Delivery moves on two fronts','التنفيذ يتحرك على مسارين'),tx('Policy and governance','السياسات والحوكمة'),tx('Technology and adoption','التقنية والتبني')],
    [tx('',''),tx('Protect delivery without slowing it','حماية التنفيذ دون إبطائه'),tx('Key risk','الخطر الرئيسي'),tx('Mitigation','إجراء التخفيف')],
  ],
  stats: [
    [tx('',''),tx('Numbers that tell the story','أرقام تروي القصة'),['72%','34%','128k','91%']],
    [tx('',''),tx('Delivery is moving in the right direction','التنفيذ يسير في الاتجاه الصحيح'),['18','6','84%','3.2×']],
    [tx('',''),tx('Impact reaches people and services','الأثر يصل إلى الناس والخدمات'),['2.4m','42','−28%','96%']],
    [tx('',''),tx('A balanced portfolio at a glance','محفظة متوازنة في لمحة'),['AED 8.4bn','12','7','89%']],
    [tx('',''),tx('Four outcomes define success','أربع نتائج تحدد النجاح'),['+16pp','4.6/5','−12 days','92%']],
  ],
  quote: [
    [tx('Leadership quote','اقتباس قيادي'),tx('Lead with the conclusion, then make the evidence impossible to miss.','ابدأ بالخلاصة، ثم اجعل الأدلة واضحة لا يمكن إغفالها.'),tx('Executive sponsor','الراعي التنفيذي')],
    [tx('Vision statement','بيان الرؤية'),tx('Public finance should feel simpler, faster, and more trusted for everyone.','ينبغي أن تكون المالية العامة أبسط وأسرع وأكثر موثوقية للجميع.'),tx('Programme vision','رؤية البرنامج')],
    [tx('User voice','صوت المستخدم'),tx('Give me one clear path, and tell me what will happen next.','امنحني مساراً واضحاً واحداً، وأخبرني بما سيحدث تالياً.'),tx('Service user','مستخدم الخدمة')],
    [tx('Policy principle','مبدأ السياسة'),tx('Trust grows when decisions are transparent and outcomes are measurable.','تنمو الثقة عندما تكون القرارات شفافة والنتائج قابلة للقياس.'),tx('Design principle','مبدأ التصميم')],
    [tx('Closing thought','فكرة ختامية'),tx('The opportunity is not only to digitise the process, but to redesign the experience.','الفرصة ليست في رقمنة العملية فحسب، بل في إعادة تصميم التجربة.'),tx('Transformation team','فريق التحول')],
  ],
  closing: [
    [tx('Next actions','الخطوات التالية'),tx('End with clarity and momentum.','اختتم بوضوح وزخم.'),tx('Confirm the decision, assign the owner, and set the first milestone.','أكد القرار وحدد المسؤول وضع أول محطة.')],
    [tx('Decision ask','القرار المطلوب'),tx('Approve the direction today.','اعتمد التوجه اليوم.'),tx('This decision unlocks the first 90 days of delivery.','هذا القرار يطلق أول ٩٠ يوماً من التنفيذ.')],
    [tx('Thank you','شكراً لكم'),tx('Thank you.','شكراً لكم.'),tx('Questions and discussion','الأسئلة والنقاش')],
    [tx('Closing','الختام'),tx('Continue the conversation.','لنواصل الحوار.'),tx('Ministry of Finance · United Arab Emirates','وزارة المالية · الإمارات العربية المتحدة')],
    [tx('Commitment','الالتزام'),tx('From decision to measurable impact.','من القرار إلى أثر قابل للقياس.'),tx('One owner. One milestone. One shared outcome.','مسؤول واحد. محطة واحدة. نتيجة مشتركة.')],
  ],
};

const statNames = [tx('Primary outcome','النتيجة الرئيسية'),tx('Efficiency','الكفاءة'),tx('Adoption','التبني'),tx('Satisfaction','الرضا')];
const tableHeads = [tx('Criterion','المعيار'),tx('Current','الحالي'),tx('Target','المستهدف'),tx('Direction','التوجه')];
const tableRows = [
  [['Time to value','وقت تحقيق القيمة'],['Medium','متوسط'],['Fast','سريع'],['On track','على المسار']],
  [['Implementation effort','جهد التنفيذ'],['Low','منخفض'],['Medium','متوسط'],['Managed','تحت الإدارة']],
  [['Long-term flexibility','المرونة طويلة الأجل'],['Limited','محدودة'],['High','مرتفعة'],['Improving','تتحسن']],
  [['Strategic alignment','المواءمة الاستراتيجية'],['Partial','جزئية'],['Strong','قوية'],['Preferred','مفضل']],
];
const chartValues = [[42,58,67,76,88],[86,74,61,38],[18,25,39,61,82],[42,31,18,9],[45,62,78,92]];
const chartTitles = [tx('Progress builds consistently over time','يتحقق التقدم باستمرار مع مرور الوقت'),tx('Three drivers create most of the value','ثلاثة محركات تحقق معظم القيمة'),tx('Adoption accelerates after the pilot','يتسارع التبني بعد المرحلة التجريبية'),tx('Value is balanced across outcomes','القيمة متوازنة بين النتائج'),tx('Every workstream adds to the result','كل مسار عمل يضيف إلى النتيجة')];
const coverLabels = [tx('Editorial cover','غلاف تحريري'),tx('Strategic report cover','غلاف تقرير استراتيجي'),tx('Impact cover','غلاف الأثر'),tx('Statement cover','غلاف بياني'),tx('Policy outlook cover','غلاف آفاق السياسات')];
// Catalogue nav names only. Dividers carry no eyebrow, so these never reach a slide.
const sectionLabels = [tx('Chapter','فصل'),tx('Evidence','الأدلة'),tx('Action','الإجراءات'),tx('Delivery','التنفيذ'),tx('Decision','القرار')];

// Covers and section dividers share one brand header so the mark never moves.
const brandHead = (locale: Locale) =>
  `<header class="brand-head"><img class="brand-logo" src="${coverLogoFor(locale)}" alt="United Arab Emirates Ministry of Finance"/></header>`;

// --- AI slot contract --------------------------------------------------------
// Every editable string in the deck is wrapped in a matched comment pair:
//
//   <!-- MOF-SLOT id="cover-1.title" field="title" max="40" desc="Cover headline:
//        the single main statement of the deck" -->Actual text<!-- /MOF-SLOT id="cover-1.title" -->
//
//   id     stable key, "<type>-<variant>.<field>", unique within a slide
//   field  short kind of content: title, subtitle, eyebrow, number, date, ...
//   max    hard character limit; going over it breaks the fixed 1920x1080 layout
//   desc   what the model should write here
//
// Language and direction are not repeated per slot; read them from the enclosing
// <section lang="en|ar" dir="ltr|rtl" data-layout="..." data-variant="...">.
//
// EXTRACT (n8n Code node) - match globally, send id/field/max/desc to the model:
//   /<!-- MOF-SLOT id="([^"]+)" field="([^"]+)" max="(\d+)" desc="([^"]*)" -->([\s\S]*?)<!-- \/MOF-SLOT id="\1" -->/g
//
// INSERT - rebuild the same pair around the generated text so the slot stays
// re-editable. Writing the bare text loses the slot on the next pass:
//   html.replace(new RegExp('(<!-- MOF-SLOT id="'+id+'"[^>]*-->)[\\s\\S]*?(<!-- /MOF-SLOT id="'+id+'" -->)'),
//                '$1'+generated+'$2')
//
// Each slide also has one outer MOF-SECTION pair around its complete editable
// layout div. Extract that when the model should rewrite the full slide block:
//   /<!-- MOF-SECTION id="([^"]+)" max="(\d+)" desc="([^"]*)" -->([\s\S]*?)<!-- \/MOF-SECTION id="\1" -->/g
//
// `max` on MOF-SECTION is the total visible-character budget for the entire div.
// The model must preserve the outer div, its classes, and every nested MOF-SLOT
// comment. Footer and page number are separate editable slots in the slide chrome.
const fill = (id: string, what: string, max: number, value: string) => {
  const field = id.slice(id.lastIndexOf('.') + 1);
  return `<!-- MOF-SLOT id="${id}" field="${field}" max="${max}" desc="${what}" -->${value}<!-- /MOF-SLOT id="${id}" -->`;
};

const sectionCharacterLimits: Record<SlideType, number[]> = {
  cover: [240, 226, 206, 222, 216],
  section: [144, 144, 118, 160, 118],
  bullets: [320, 192, 206, 206, 146],
  two_col: [322, 322, 322, 322, 322],
  stats: [362, 362, 362, 362, 362],
  table: [432, 432, 432, 432, 432],
  chart: [248, 274, 248, 284, 248],
  quote: [198, 164, 170, 188, 170],
  closing: [264, 128, 16, 150, 122],
};

const editableSection = (type: SlideType, variant: number, html: string) => {
  const id = `${type}-${variant}.section`;
  const max = sectionCharacterLimits[type][variant - 1];
  return `<!-- MOF-SECTION id="${id}" max="${max}" desc="Complete editable slide div; preserve its outer element, classes, structure, and nested MOF-SLOT comments" -->${html}<!-- /MOF-SECTION id="${id}" -->`;
};

function chrome(locale: Locale, index: number, type: SlideType, variant: number, label: Localized, body: string, specialTheme = '', visualTheme: SlideTheme = 'white_gold') {
  const footerText = t(tx('Ministry of Finance', 'وزارة المالية'), locale);
  const pageNumber = num(index + 1, locale).padStart(2, locale === 'ar' ? '٠' : '0');
  const footer = fill(`${type}-${variant}.footer`, 'Editable footer shown at the bottom of this slide', 40, footerText);
  const editablePageNumber = fill(`${type}-${variant}.page-number`, 'Editable page number, normally two digits', 3, pageNumber);
  return `<section class="slide ${specialTheme} palette-${visualTheme}" data-slide="${index + 1}" data-layout="${type}" data-variant="${variant}" data-theme="${visualTheme}" lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><div class="logo-band" aria-hidden="true"></div><div class="accent-line"></div>${editableSection(type, variant, body)}<footer class="slide-footer"><span>${footer}</span><span class="footer-rule"></span><span data-page-number="${index + 1}">${editablePageNumber}</span></footer></section>`;
}

function titleRow(locale: Locale, label: Localized, title: Localized, note: Localized, id: string) {
  return `<header class="title-row"><div><div class="eyebrow">${fill(`${id}.eyebrow`, 'Short kicker above the title naming the slide, upper case', 28, t(label, locale))}</div><h2>${fill(`${id}.title`, 'Slide title, no full stop', 48, t(title, locale))}</h2></div><p>${fill(`${id}.note`, 'One sentence beside the title stating the point of the slide', 90, t(note, locale))}</p></header>`;
}

function titleOnly(locale: Locale, title: Localized, id: string) {
  return `<header class="title-row title-only"><div><h2>${fill(`${id}.title`, 'Slide title, no full stop', 56, t(title, locale))}</h2></div></header>`;
}

function chartVisual(variant: number, locale: Locale) {
  const values = chartValues[variant - 1];
  const id = `chart-${variant}`;
  if (variant === 2) return `<div class="h-bars">${values.map((v,i)=>`<div><b>${fill(`${id}.bar-${i + 1}.label`, 'Name of this bar', 18, t([tx('Data exchange','تبادل البيانات'),tx('User journey','رحلة المستخدم'),tx('Analytics','التحليلات'),tx('Controls','الضوابط')][i],locale))}</b><span><i style="width:${v}%"></i></span><strong>${fill(`${id}.bar-${i + 1}.value`, 'Value of this bar, with its unit', 6, `${num(v,locale)}%`)}</strong></div>`).join('')}</div>`;
  if (variant === 3) return `<div class="line-chart"><svg viewBox="0 0 1000 420" role="img" aria-label="Rising adoption"><g class="grid"><line x1="40" y1="80" x2="960" y2="80"/><line x1="40" y1="200" x2="960" y2="200"/><line x1="40" y1="320" x2="960" y2="320"/></g><polyline points="70,330 285,295 500,235 715,145 930,55"/><g class="points"><circle cx="70" cy="330" r="10"/><circle cx="285" cy="295" r="10"/><circle cx="500" cy="235" r="10"/><circle cx="715" cy="145" r="10"/><circle cx="930" cy="55" r="10"/></g></svg><div class="axis-labels">${values.map((v,i)=>`<span>${fill(`${id}.point-${i + 1}.label`, 'Label under this point', 8, `Q${i+1}`)}<b>${fill(`${id}.point-${i + 1}.value`, 'Value of this point, with its unit', 6, `${v}%`)}</b></span>`).join('')}</div></div>`;
  if (variant === 4) return `<div class="donut-wrap"><div class="donut"><div><strong>${fill(`${id}.donut.value`, 'Figure in the centre of the ring', 6, '42%')}</strong><span>${fill(`${id}.donut.label`, 'What the centre figure measures', 16, t(tx('Efficiency','الكفاءة'),locale))}</span></div></div><div class="legend">${[tx('Efficiency','الكفاءة'),tx('Experience','التجربة'),tx('Trust','الثقة'),tx('Other','أخرى')].map((x,i)=>`<p><i></i><span>${fill(`${id}.legend-${i + 1}.label`, 'Name of this share', 16, t(x,locale))}</span><b>${fill(`${id}.legend-${i + 1}.value`, 'Share of this item, with its unit', 6, `${values[i]}%`)}</b></p>`).join('')}</div></div>`;
  if (variant === 5) return `<div class="stacked-chart">${values.map((v,i)=>`<div><span>${fill(`${id}.column-${i + 1}.label`, 'Label under this column', 8, `Q${i+1}`)}</span><div class="stack"><i style="flex:0 0 ${Math.round(v*.46)}%"></i><i style="flex:0 0 ${Math.round(v*.32)}%"></i><i style="flex:0 0 ${Math.round(v*.22)}%"></i></div><b>${fill(`${id}.column-${i + 1}.total`, 'Total for this column, with its unit', 6, `${v}%`)}</b></div>`).join('')}</div>`;
  return `<div class="column-chart">${values.map((v,i)=>`<div><strong>${fill(`${id}.column-${i + 1}.value`, 'Value above this column, with its unit', 6, `${num(v,locale)}%`)}</strong><i style="flex:0 0 ${v}%"></i><span>${fill(`${id}.column-${i + 1}.label`, 'Label under this column', 8, `Q${i+1}`)}</span></div>`).join('')}</div>`;
}

function renderBody(type: SlideType, variant: number, locale: Locale, index: number): { label: Localized; body: string; theme?: string; footer?: Localized } {
  if (type === 'cover') {
    const [title,subtitle] = content.cover[variant-1]; const label = coverLabels[variant-1];
    const titleMax = [40, 36, 36, 32, 28][variant - 1];
    const subtitleMax = [110, 100, 80, 100, 110][variant - 1];
    const id = `cover-${variant}`;
    const art = variant === 3 ? '<div class="cover-art" aria-hidden="true"></div>' : '';
    return { label, body:`<div class="catalog-cover cover-v${variant}">${art}${brandHead(locale)}<div class="cover-copy"><div class="eyebrow">${fill(`${id}.eyebrow`, 'Short kicker above the title naming the document type, upper case', 24, t(tx('MINISTRY PRESENTATION','عرض الوزارة'),locale))}</div><h1>${fill(`${id}.title`, 'Cover headline: the single main statement of the deck, no full stop', titleMax, t(title,locale))}</h1><p>${fill(`${id}.subtitle`, 'One sentence under the headline saying what the deck covers', subtitleMax, t(subtitle,locale))}</p></div><footer class="cover-foot"><div class="cover-meta"><b>${fill(`${id}.meta-label`, 'Fixed lead-in before the audience, e.g. Prepared for', 16, t(tx('Prepared for','أُعدّ من أجل'),locale))}</b><span>${fill(`${id}.audience`, 'Who the deck is prepared for: council, department or committee name', 32, t(tx('Audience or department','الجمهور أو الإدارة'),locale))}</span><i></i><b>${fill(`${id}.date`, 'Presentation date as month and year', 18, t(tx('September 2026','سبتمبر ٢٠٢٦'),locale))}</b></div></footer></div>`, theme:'cover-slide' };
  }
  if (type === 'section') {
    const [title,subtitle] = content.section[variant-1]; const label=sectionLabels[variant-1];
    const titleMax = [42, 42, 36, 48, 36][variant - 1];
    const subtitleMax = [100, 100, 80, 110, 80][variant - 1];
    const id = `section-${variant}`;
    return { label, footer: tx('',''), body:`<div class="catalog-section section-v${variant}">${brandHead(locale)}<div class="section-body"><div class="section-number">${fill(`${id}.number`, 'Two-digit section number, zero padded, digits only', 2, `0${variant}`)}</div><div class="section-copy"><h2>${fill(`${id}.title`, 'Section heading: names the part of the deck that follows, no full stop', titleMax, t(title,locale))}</h2><p>${fill(`${id}.subtitle`, 'One line saying what this section will cover', subtitleMax, t(subtitle,locale))}</p></div></div></div>`, theme:'' };
  }
  if (type === 'bullets') {
    const [,title,items] = content.bullets[variant-1] as [Localized,Localized,Localized[]];
    const headingMax = [42, 32, 48, 28, 28][variant - 1];
    const id = `bullets-${variant}`;
    return { label:title, footer:tx('',''), body:`<div class="slide-shell">${brandHead(locale)}${titleOnly(locale,title,id)}<div class="bullet-layout bullets-v${variant}">${items.map((item,i)=>`<article class="bullet-item"><span>${fill(`${id}.item-${i + 1}.number`, 'Two-digit item number, zero padded, digits only', 2, `0${i+1}`)}</span><div>${variant===3?icon('check'):''}<h3>${fill(`${id}.item-${i + 1}.heading`, 'One specific point, no full stop', headingMax, t(item,locale))}</h3></div>${variant===1?icon('arrow'):''}</article>`).join('')}</div></div>` };
  }
  if (type === 'two_col') {
    const [,title,left,right] = content.twoCol[variant-1];
    const id = `two_col-${variant}`;
    const column=(heading:Localized,side:'left'|'right')=>`<article class="comparison-column ${side}"><div class="column-kicker">${fill(`${id}.${side}.kicker`, side==='left'?'Kicker for the left column, upper case':'Kicker for the right column, upper case', 16, side==='left'?t(tx('CURRENT','الحالي'),locale):t(tx('DIRECTION','التوجه'),locale))}</div><h3>${fill(`${id}.${side}.heading`, side==='left'?'Left column heading':'Right column heading', 32, t(heading,locale))}</h3><ul><li>${icon('check')}<span>${fill(`${id}.${side}.point-1`, side==='left'?'First point in the left column':'First point in the right column', 42, t(side==='left'?tx('Current state or constraint','الوضع الحالي أو القيد'):tx('Desired outcome or response','النتيجة أو الاستجابة المطلوبة'),locale))}</span></li><li>${icon('check')}<span>${fill(`${id}.${side}.point-2`, side==='left'?'Second point in the left column':'Second point in the right column', 42, t(side==='left'?tx('Second concise point','نقطة موجزة ثانية'):tx('Second measurable benefit','فائدة ثانية قابلة للقياس'),locale))}</span></li></ul></article>`;
    return { label:title, footer:tx('',''), body:`<div class="slide-shell">${brandHead(locale)}${titleOnly(locale,title,id)}<div class="two-col-layout two-col-v${variant}">${column(left,'left')}<div class="versus">${variant===2?'VS':'→'}</div>${column(right,'right')}</div></div>` };
  }
  if (type === 'stats') {
    const [,title,values] = content.stats[variant-1] as [Localized,Localized,string[]];
    const id = `stats-${variant}`;
    return { label:title, footer:tx('',''), body:`<div class="slide-shell">${brandHead(locale)}${titleOnly(locale,title,id)}<div class="stats-layout stats-v${variant}">${values.map((value,i)=>`<article class="stat-item ${i===0?'primary':''}"><div class="stat-accent"></div><strong>${fill(`${id}.stat-${i + 1}.value`, i===0?'Headline figure, with its unit':'Supporting figure, with its unit', i===0?8:10, value)}</strong><h3>${fill(`${id}.stat-${i + 1}.name`, 'Name of this measure', 22, t(statNames[i],locale))}</h3><p>${fill(`${id}.stat-${i + 1}.note`, 'One line on what this figure means', i===0?60:40, t(tx(i===0?'The headline measure and why it matters.':'Supporting measure',i===0?'المقياس الرئيسي وسبب أهميته.':'مقياس داعم'),locale))}</p></article>`).join('')}</div></div>` };
  }
  if (type === 'table') {
    const title=tx(['Compare paths against what matters','The portfolio remains on track','Investment follows measurable value','Focus attention where exposure is highest','Evidence makes the choice visible'][variant-1],['قارن المسارات وفقاً لما يهم','المحفظة مستمرة على المسار','الاستثمار يتبع القيمة القابلة للقياس','ركز الاهتمام حيث يكون التعرض أعلى','الأدلة تجعل الخيار واضحاً'][variant-1]);
    const id = `table-${variant}`;
    return { label:title, footer:tx('',''), body:`<div class="slide-shell">${brandHead(locale)}${titleOnly(locale,title,id)}<div class="data-table table-v${variant}"><div class="table-row table-head">${tableHeads.map((h,ci)=>`<b>${fill(`${id}.col-${ci + 1}.header`, 'Column header, one or two words', 18, t(h,locale))}</b>`).join('')}</div>${tableRows.map((row,ri)=>`<div class="table-row ${variant===5&&ri===0?'selected':''}">${row.map((cell,ci)=>`<${ci===0?'strong':'span'}>${fill(`${id}.r${ri + 1}.c${ci + 1}`, ci===0?'Row label':'Cell value, a few words', ci===0?28:16, cell[locale==='ar'?1:0])}${ci===3&&ri===0?'<i>✓</i>':''}</${ci===0?'strong':'span'}>`).join('')}</div>`).join('')}</div></div>` };
  }
  if (type === 'chart') {
    const title=chartTitles[variant-1];
    const id = `chart-${variant}`;
    return { label:title, footer:tx('',''), body:`<div class="slide-shell">${brandHead(locale)}${titleOnly(locale,title,id)}<div class="chart-stage chart-v${variant}">${chartVisual(variant,locale)}<aside class="chart-callout"><span>${icon('chart')}</span><strong>${fill(`${id}.callout.value`, 'The single number that summarises the chart', 6, variant===4?'4':'+46')}<sup>${variant===4?'':fill(`${id}.callout.unit`, 'Unit for the callout number, e.g. pp or %', 4, 'pp')}</sup></strong><h3>${fill(`${id}.callout.title`, 'What the callout number means', 32, t(tx(variant===4?'Balanced outcomes':'Improvement across the period',variant===4?'نتائج متوازنة':'تحسن خلال الفترة'),locale))}</h3><p>${fill(`${id}.callout.note`, 'One sentence on the implication for the next decision', 80, t(tx('State the insight and its implication for the next decision.','اذكر الرؤية وتأثيرها على القرار التالي.'),locale))}</p></aside></div></div>` };
  }
  if (type === 'quote') {
    const [label,quote,by]=content.quote[variant-1];
    // Three lines at 78px. Narrower variants hold fewer characters.
    const quoteCharLimits = [
      { quote: 110, by: 40, label: 32 },
      { quote: 80, by: 36, label: 32 },
      { quote: 90, by: 32, label: 28 },
      { quote: 100, by: 40, label: 32 },
      { quote: 90, by: 32, label: 32 },
    ] as const;
    const limits = quoteCharLimits[variant - 1];
    const id = `quote-${variant}`;
    return { label, body:`<div class="quote-layout quote-v${variant}" data-max-quote-chars="${limits.quote}" data-max-attribution-chars="${limits.by}" data-max-label-chars="${limits.label}">${brandHead(locale)}<div class="quote-body"><div class="quote-mark" aria-hidden="true">“</div><blockquote>${fill(`${id}.quote`, 'The quotation itself, with no surrounding quote marks', limits.quote, t(quote,locale))}</blockquote><div class="quote-by"><b>${fill(`${id}.attribution`, 'Who said it: name or role', limits.by, t(by,locale))}</b><small>${fill(`${id}.organisation`, 'Organisation under the name', 48, t(tx('United Arab Emirates Ministry of Finance','وزارة المالية في دولة الإمارات العربية المتحدة'),locale))}</small></div></div></div>`, theme:'' };
  }
  const [label,title,subtitle]=content.closing[variant-1];
  const titleMax = [36, 24, 16, 36, 28][variant - 1];
  const subtitleMax = [90, 80, 40, 90, 70][variant - 1];
  const actions = [tx('Confirm the decision','تأكيد القرار'), tx('Assign the owner','تحديد المسؤول'), tx('Set the first milestone','تحديد أول محطة')];
  const id = `closing-${variant}`;
  const eyebrow = variant === 3 ? '' : `<div class="eyebrow">${fill(`${id}.eyebrow`, 'Short kicker above the closing line, upper case', 24, t(label,locale))}</div>`;
  const supportingText = variant === 3 ? '' : `<p>${fill(`${id}.subtitle`, 'One sentence under the closing line', subtitleMax, t(subtitle,locale))}</p>`;
  const ending = variant === 3 ? '' : variant===1?`<div class="action-list">${actions.map((action,i)=>`<div><span>${fill(`${id}.action-${i + 1}.number`, 'Two-digit action number, digits only', 2, `0${i+1}`)}</span><b>${fill(`${id}.action-${i + 1}.label`, 'One next action', 36, t(action,locale))}</b></div>`).join('')}</div>`:'<div class="closing-rule"></div>';
  return { label, footer:tx('',''), body:`<div class="closing-layout closing-v${variant}">${brandHead(locale)}<div class="closing-copy">${eyebrow}<h2>${fill(`${id}.title`, 'Closing line, no full stop', titleMax, t(title,locale))}</h2>${supportingText}${ending}</div></div>`, theme:'closing-slide' };
}

const slides: SlideDefinition[] = slideTypes.flatMap((type,typeIndex)=>Array.from({length:5},(_,variantIndex)=>{
  const variant=variantIndex+1,index=typeIndex*5+variantIndex,initial=renderBody(type,variant,'en',index);
  return { id:`${type}-${variant}`,type,variant,label:initial.label,render:(locale,theme='white_gold')=>{ const result=renderBody(type,variant,locale,index); return chrome(locale,index,type,variant,result.footer ?? result.label,result.body,result.theme,theme); } };
}));

const app=document.querySelector<HTMLDivElement>('#app')!;
const params=new URLSearchParams(window.location.search);
let locale:Locale=params.get('lang')==='ar'?'ar':'en';
let active=Math.max(0,Math.min(slides.length-1,Number(params.get('slide')||1)-1));
let activeType:SlideType|'all'=slideTypes.includes(params.get('type') as SlideType)?params.get('type') as SlideType:'all';
let exporting=false;
const slideThemes = new Map<string, SlideTheme>(slides.map(slide => [slide.id, 'white_gold']));
const requestedTheme = params.get('theme') as SlideTheme | null;
if (requestedTheme && selectableThemes.includes(requestedTheme)) slideThemes.set(slides[active].id, requestedTheme);
const uiText={
  en:{template:'MOF slide catalogue',slides:'45 layouts · 5 per type',filter:'Filter by slide type',theme:'Slide theme',previous:'Previous',next:'Next',pdf:'Download PDF',pptx:'Download PPTX',ready:'Ready to export all 45 slides',exporting:'Rendering slide',of:'of'},
  ar:{template:'دليل شرائح وزارة المالية',slides:'٤٥ تخطيطاً · ٥ لكل نوع',filter:'تصفية حسب نوع الشريحة',theme:'نمط الشريحة',previous:'السابق',next:'التالي',pdf:'تنزيل PDF',pptx:'تنزيل PPTX',ready:'جاهز لتصدير الشرائح الـ٤٥',exporting:'جارٍ تجهيز الشريحة',of:'من'},
};

const visibleIndexes=()=>slides.map((slide,index)=>({slide,index})).filter(({slide})=>activeType==='all'||slide.type===activeType);
function syncUrl(){const next=new URLSearchParams(location.search);next.set('slide',String(active+1));next.set('lang',locale);next.set('theme',slideThemes.get(slides[active].id)??'white_gold');if(activeType==='all')next.delete('type');else next.set('type',activeType);history.replaceState(null,'',`${location.pathname}?${next}`);}
function render(){
  logoPath=logoFor(locale);document.documentElement.lang=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr';const u=uiText[locale];const visible=visibleIndexes();if(!visible.some(x=>x.index===active))active=visible[0]?.index??0;const position=visible.findIndex(x=>x.index===active);
  app.innerHTML=`<header class="toolbar"><div class="toolbar-brand"><img src="${logoPath}" alt="Ministry of Finance"/><div><b>${u.template}</b><span>${u.slides}</span></div></div><div class="toolbar-actions"><div class="locale-toggle" role="group" aria-label="Language"><button data-locale="en" class="${locale==='en'?'active':''}">EN</button><button data-locale="ar" class="${locale==='ar'?'active':''}">عربي</button></div><button class="export-button secondary" data-export="pdf">${u.pdf}</button><button class="export-button primary" data-export="pptx">${u.pptx}</button></div></header><main class="workspace"><aside class="catalog-nav"><div class="filter-panel"><b>${u.filter}</b><div class="filter-chips">${(['all',...slideTypes] as const).map(type=>`<button data-type="${type}" class="${activeType===type?'active':''}"><span>${t(typeLabels[type],locale)}</span><small>${type==='all'?45:5}</small></button>`).join('')}</div></div><nav class="slide-nav" aria-label="${u.filter}">${visible.map(({slide,index})=>`<button class="thumb ${index===active?'active':''}" data-index="${index}"><div><small>${t(typeLabels[slide.type],locale)}</small><b>${t(slide.label,locale)}</b></div></button>`).join('')}</nav></aside><section class="preview-area"><div class="preview-viewport"><div class="preview-scaler" id="preview-scaler">${slides[active].render(locale)}</div></div><div class="preview-controls"><button data-move="-1" ${position<=0?'disabled':''}>${u.previous}</button><span>${t(slides[active].label,locale)}</span><button data-move="1" ${position>=visible.length-1?'disabled':''}>${u.next}</button></div><div class="export-status" id="export-status" aria-live="polite">${u.ready}</div></section></main><div class="export-deck" id="export-deck" aria-hidden="true">${slides.map(slide=>slide.render(locale)).join('')}</div>`;
  const selectedTheme=slideThemes.get(slides[active].id)??'white_gold';
  document.querySelector<HTMLElement>('#preview-scaler')!.innerHTML=slides[active].render(locale,selectedTheme);
  document.querySelector<HTMLElement>('#export-deck')!.innerHTML=slides.map(slide=>slide.render(locale,slideThemes.get(slide.id)??'white_gold')).join('');
  document.querySelector<HTMLElement>('.preview-controls')?.insertAdjacentHTML('afterbegin',`<label class="theme-picker"><span>${u.theme}</span><select data-slide-theme aria-label="${u.theme}">${selectableThemes.map(theme=>`<option value="${theme}" ${theme===selectedTheme?'selected':''}>${t(themeLabels[theme],locale)}</option>`).join('')}</select></label>`);
  syncUrl();bindEvents();requestAnimationFrame(scalePreview);
}
function bindEvents(){
  document.querySelector<HTMLSelectElement>('[data-slide-theme]')?.addEventListener('change',event=>{slideThemes.set(slides[active].id,(event.currentTarget as HTMLSelectElement).value as SlideTheme);render();});
  document.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach(button=>button.addEventListener('click',()=>{if(!exporting){locale=button.dataset.locale as Locale;render();}}));
  document.querySelectorAll<HTMLButtonElement>('[data-type]').forEach(button=>button.addEventListener('click',()=>{activeType=button.dataset.type as SlideType|'all';active=visibleIndexes()[0]?.index??0;render();}));
  document.querySelectorAll<HTMLButtonElement>('[data-index]').forEach(button=>button.addEventListener('click',()=>{active=Number(button.dataset.index);render();}));
  document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(button=>button.addEventListener('click',()=>{const visible=visibleIndexes(),position=visible.findIndex(x=>x.index===active);active=visible[Math.max(0,Math.min(visible.length-1,position+Number(button.dataset.move)))].index;render();}));
  document.querySelectorAll<HTMLButtonElement>('[data-export]').forEach(button=>button.addEventListener('click',()=>exportDeck(button.dataset.export as 'pdf'|'pptx')));
}
function scalePreview(){const viewport=document.querySelector<HTMLElement>('.preview-viewport'),scaler=document.querySelector<HTMLElement>('#preview-scaler');if(!viewport||!scaler)return;const scale=Math.min((viewport.clientWidth-32)/1920,(viewport.clientHeight-32)/1080);scaler.style.transform=`scale(${Math.max(scale,.1)})`;}
async function waitForAssets(){await document.fonts.ready;const images=Array.from(document.querySelectorAll<HTMLImageElement>('#export-deck img'));await Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise<void>((resolve,reject)=>{img.addEventListener('load',()=>resolve(),{once:true});img.addEventListener('error',()=>reject(new Error(`Unable to load ${img.src}`)),{once:true});})));}
async function captureSlides(){await waitForAssets();const nodes=Array.from(document.querySelectorAll<HTMLElement>('#export-deck .slide')),captures:string[]=[];for(let i=0;i<nodes.length;i++){updateStatus(`${uiText[locale].exporting} ${i+1} ${uiText[locale].of} ${nodes.length}`);captures.push(await toPng(nodes[i],{width:1920,height:1080,pixelRatio:1,cacheBust:true,backgroundColor:'#ffffff'}));await new Promise(resolve=>requestAnimationFrame(resolve));}return captures;}
async function exportDeck(format:'pdf'|'pptx'){if(exporting)return;exporting=true;document.body.classList.add('is-exporting');try{const captures=await captureSlides(),suffix=locale==='ar'?'ar':'en';if(format==='pdf'){const pdf=new jsPDF({orientation:'landscape',unit:'in',format:[13.333,7.5],compress:true});captures.forEach((data,index)=>{if(index>0)pdf.addPage([13.333,7.5],'landscape');pdf.addImage(data,'PNG',0,0,13.333,7.5,undefined,'FAST');});pdf.save(`mof-slide-catalogue-${suffix}.pdf`);}else{const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='United Arab Emirates Ministry of Finance';pptx.subject='Bilingual MOF slide catalogue';pptx.title='MOF Slide Catalogue';pptx.company='United Arab Emirates Ministry of Finance';captures.forEach(data=>{const slide=pptx.addSlide();slide.background={color:'FFFFFF'};slide.addImage({data,x:0,y:0,w:13.333,h:7.5});});await pptx.writeFile({fileName:`mof-slide-catalogue-${suffix}.pptx`});}updateStatus(uiText[locale].ready);}catch(error){console.error(error);updateStatus(locale==='ar'?'تعذر إكمال التصدير. يرجى المحاولة مرة أخرى.':'Export could not be completed. Please try again.',true);}finally{exporting=false;document.body.classList.remove('is-exporting');}}
function updateStatus(message:string,error=false){const element=document.querySelector<HTMLElement>('#export-status');if(!element)return;element.textContent=message;element.classList.toggle('error',error);}
window.addEventListener('resize',scalePreview);render();
