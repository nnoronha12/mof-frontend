import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowPathIcon,
  DocumentArrowUpIcon,
  PencilSquareIcon,
  PlusIcon,
  ScaleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import {
  BackendService,
  ProposalFramework,
  ProposalFrameworkError,
  ProposalFrameworkInput,
} from '../services/backendService';

interface ProposalFrameworkAdminProps {
  apiConfig: { baseUrl: string; headers?: Record<string, string> };
  isArabic: boolean;
  themeColor: string;
}

interface CriterionRow {
  key: string;
  criterion: string;
  weight: string;
  guidance: string;
}

interface FormState {
  id?: string;
  name: string;
  description: string;
  appliesTo: string;
  language: 'en' | 'ar';
  criteria: CriterionRow[];
  sourceFilename: string;
  sourceText: string;
}

const allowedExtensions = /\.(pdf|docx|pptx|png|jpe?g|txt)$/i;
const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;
const ACCEPT = '.pdf,.docx,.pptx,.png,.jpg,.jpeg,.txt';

let rowSeed = 0;
const row = (criterion = '', weight = '', guidance = ''): CriterionRow => ({
  key: `criterion-${++rowSeed}`,
  criterion,
  weight,
  guidance,
});

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  appliesTo: '',
  language: 'en',
  criteria: [row(), row()],
  sourceFilename: '',
  sourceText: '',
});

const weightOf = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const ProposalFrameworkAdmin: React.FC<ProposalFrameworkAdminProps> = ({
  apiConfig,
  isArabic,
  themeColor,
}) => {
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const service = useMemo(
    () => new BackendService(apiConfig.baseUrl, apiConfig.headers),
    [apiConfig.baseUrl, JSON.stringify(apiConfig.headers ?? {})],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [frameworks, setFrameworks] = useState<ProposalFramework[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const errorText = (cause: unknown) => {
    const status = cause instanceof ProposalFrameworkError ? cause.status : 0;
    if (status === 401) return t('Your session has expired. Sign in again.', 'انتهت جلستك. سجّل الدخول مرة أخرى.');
    if (status === 403) return t('You do not have permission to manage evaluation frameworks.', 'ليست لديك صلاحية إدارة أطر التقييم.');
    if (status === 422) return t('The document could not be read. Check the file and try again.', 'تعذرت قراءة المستند. تحقق من الملف وحاول مرة أخرى.');
    if (status === 400) return t('Check the form and try again.', 'تحقق من النموذج وحاول مرة أخرى.');
    if (status === 404) return t('This framework no longer exists. Refresh the list.', 'لم يعد هذا الإطار موجوداً. حدّث القائمة.');
    return t('Something went wrong. Please try again.', 'حدث خطأ ما. يرجى المحاولة مرة أخرى.');
  };

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      setFrameworks(await service.listProposalFrameworks());
      setAccessDenied(false);
    } catch (cause) {
      if (cause instanceof ProposalFrameworkError && (cause.status === 401 || cause.status === 403)) {
        setAccessDenied(true);
      } else {
        setError(errorText(cause));
      }
    } finally {
      if (showLoading) setLoading(false);
    }
    // errorText only depends on the language, which re-renders anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service]);

  useEffect(() => {
    void load();
  }, [load]);

  const weightTotal = form.criteria.reduce((sum, c) => sum + weightOf(c.weight), 0);
  const filledCriteria = form.criteria.filter((c) => c.criterion.trim() || c.weight.trim() || c.guidance.trim());

  const validationError = (() => {
    if (!form.name.trim()) return t('Enter a name.', 'أدخل اسماً.');
    if (!form.appliesTo.trim()) return t('Describe which RFPs this framework applies to.', 'صف طلبات العروض التي ينطبق عليها هذا الإطار.');
    if (filledCriteria.length < 2 || filledCriteria.length > 12) return t('Add between 2 and 12 criteria.', 'أضف من 2 إلى 12 معياراً.');
    if (filledCriteria.some((c) => !c.criterion.trim() || !(weightOf(c.weight) > 0))) {
      return t('Each criterion needs a name and a weight above 0.', 'يحتاج كل معيار إلى اسم ووزن أكبر من صفر.');
    }
    const names = filledCriteria.map((c) => c.criterion.trim().toLowerCase());
    if (new Set(names).size !== names.length) return t('Criterion names must be unique.', 'يجب أن تكون أسماء المعايير فريدة.');
    if (Math.abs(weightTotal - 100) > 0.01) return t('Weights must total 100.', 'يجب أن يكون مجموع الأوزان 100.');
    return '';
  })();

  const resetForm = () => {
    setForm(emptyForm());
    setFile(null);
    setNotes([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateCriterion = (key: string, patch: Partial<CriterionRow>) => {
    setForm((current) => ({
      ...current,
      criteria: current.criteria.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    }));
  };

  const extract = async () => {
    setMessage('');
    setError('');
    if (!file || !allowedExtensions.test(file.name) || file.size > MAX_UPLOAD_BYTES) {
      setError(t('Select a PDF, DOCX, PPTX, PNG, JPG or TXT file up to 16 MB.', 'اختر ملف PDF أو DOCX أو PPTX أو PNG أو JPG أو TXT بحجم لا يتجاوز 16 ميجابايت.'));
      return;
    }
    setExtracting(true);
    try {
      const result = await service.extractProposalFramework(file, isArabic ? 'ar' : 'en');
      setForm((current) => ({
        id: current.id,
        name: result.draft.name,
        description: result.draft.description,
        appliesTo: result.draft.appliesTo,
        language: result.draft.language,
        criteria: result.draft.criteria.length
          ? result.draft.criteria.map((c) => row(c.criterion, String(c.weight), c.guidance))
          : [row(), row()],
        sourceFilename: result.sourceFilename,
        sourceText: result.sourceText,
      }));
      setNotes(result.notes);
      setMessage(t('The form was filled from the document. Review it, then save.', 'تمت تعبئة النموذج من المستند. راجعه ثم احفظه.'));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setExtracting(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (validationError) {
      setError(validationError);
      return;
    }
    const payload: ProposalFrameworkInput = {
      ...(form.id ? { id: form.id } : {}),
      name: form.name.trim(),
      description: form.description.trim(),
      appliesTo: form.appliesTo.trim(),
      language: form.language,
      criteria: filledCriteria.map((c) => ({
        criterion: c.criterion.trim(),
        weight: weightOf(c.weight),
        guidance: c.guidance.trim(),
      })),
      ...(form.sourceFilename ? { sourceFilename: form.sourceFilename } : {}),
      ...(form.sourceText ? { sourceText: form.sourceText } : {}),
    };
    setSaving(true);
    try {
      await service.saveProposalFramework(payload);
      setMessage(form.id ? t('Framework updated.', 'تم تحديث الإطار.') : t('Framework saved.', 'تم حفظ الإطار.'));
      resetForm();
      await load(false);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  const edit = (framework: ProposalFramework) => {
    setMessage('');
    setError('');
    setNotes([]);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setForm({
      id: framework.id,
      name: framework.name,
      description: framework.description,
      appliesTo: framework.appliesTo,
      language: framework.language === 'ar' ? 'ar' : 'en',
      criteria: framework.criteria.map((c) => row(c.criterion, String(c.weight), c.guidance ?? '')),
      sourceFilename: framework.sourceFilename ?? '',
      sourceText: '',
    });
  };

  const toggleActive = async (framework: ProposalFramework) => {
    if (framework.active) {
      const confirmed = window.confirm(
        t(
          `Stop using "${framework.name}" for new evaluations? Past evaluations keep their results.`,
          `إيقاف استخدام "${framework.name}" في التقييمات الجديدة؟ تحتفظ التقييمات السابقة بنتائجها.`,
        ),
      );
      if (!confirmed) return;
    }
    setBusyId(framework.id);
    setMessage('');
    setError('');
    try {
      await service.setProposalFrameworkActive(framework.id, !framework.active);
      setMessage(framework.active ? t('Framework deactivated.', 'تم إيقاف الإطار.') : t('Framework activated.', 'تم تفعيل الإطار.'));
      await load(false);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusyId('');
    }
  };

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="p-8 text-sm text-[#667085]">
        {t('Loading evaluation frameworks…', 'جارٍ تحميل أطر التقييم…')}
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
        {t('You do not have permission to manage evaluation frameworks.', 'ليست لديك صلاحية إدارة أطر التقييم.')}
      </div>
    );
  }

  const inputClass = 'mt-1.5 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#344054] outline-none transition focus:border-[#C6A75D] focus:ring-2 focus:ring-[#C6A75D]/20';

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="space-y-4">
      <div className={isArabic ? 'text-right' : ''}>
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-[#101828]">
          {t('Evaluation frameworks', 'أطر التقييم')}
        </h2>
        <p className="mt-1 text-sm text-[#667085]">
          {t(
            'Upload an evaluation methodology to fill the form, review the criteria and weights, then save. Proposal Evaluation picks the framework that best fits each RFP, and uses the standard MOF criteria when none fits.',
            'ارفع منهجية تقييم لتعبئة النموذج، وراجع المعايير والأوزان، ثم احفظ. يختار تقييم المقترحات الإطار الأنسب لكل طلب عروض، ويستخدم معايير وزارة المالية القياسية عند عدم وجود إطار مناسب.',
          )}
        </p>
      </div>

      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-gray-900">
              {t('Saved frameworks', 'الأطر المحفوظة')}
              <span className="ms-2 rounded-full bg-[#FFF9F0] px-2.5 py-0.5 text-xs font-semibold text-[#8A6D2F]">
                {frameworks.length}
              </span>
            </h3>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <ArrowPathIcon className="h-4 w-4" />
              {t('Refresh', 'تحديث')}
            </button>
          </div>

          <div className="space-y-2">
            {frameworks.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
                {t(
                  'No frameworks yet. Every evaluation uses the standard MOF criteria until you add one.',
                  'لا توجد أطر بعد. تستخدم جميع التقييمات معايير وزارة المالية القياسية حتى تضيف إطاراً.',
                )}
              </div>
            )}
            {frameworks.map((framework) => (
              <article
                key={framework.id}
                className={`rounded-xl border bg-white p-4 ${form.id === framework.id ? 'border-[#C6A75D]' : 'border-gray-200'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#FFF9F0]">
                    <ScaleIcon className="h-5 w-5 text-[#8A6D2F]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-gray-900">{framework.name}</div>
                    {framework.appliesTo && (
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">{framework.appliesTo}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>{t(`${framework.criteria.length} criteria`, `${framework.criteria.length} معايير`)}</span>
                      <span>·</span>
                      <span>{t(`Used in ${framework.usageCount} evaluations`, `استُخدم في ${framework.usageCount} تقييمات`)}</span>
                      {framework.sourceFilename && (
                        <>
                          <span>·</span>
                          <span className="truncate">{framework.sourceFilename}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${framework.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {framework.active ? t('Active', 'مفعّل') : t('Inactive', 'غير مفعّل')}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => edit(framework)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8DDBF] bg-[#FFFCF5] px-3 py-2 text-xs font-semibold text-[#8A6D2F] hover:bg-[#F3E8CC]"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                    {t('Edit', 'تعديل')}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === framework.id}
                    onClick={() => void toggleActive(framework)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${framework.active ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'}`}
                  >
                    {framework.active ? t('Deactivate', 'إيقاف') : t('Activate', 'تفعيل')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <form onSubmit={save} className="w-full rounded-xl border border-[#E8DDBF] bg-[#FFFCF5] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-gray-900">
              {form.id ? t('Edit framework', 'تعديل الإطار') : t('New framework', 'إطار جديد')}
            </h3>
            {form.id && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8A6D2F] hover:underline"
              >
                <PlusIcon className="h-4 w-4" />
                {t('Start a new framework', 'بدء إطار جديد')}
              </button>
            )}
          </div>

          <div className="rounded-lg border border-dashed border-[#E8DDBF] bg-white p-3">
            <label className="block text-sm font-semibold text-gray-800" htmlFor="framework-file">
              {t('Fill from a document', 'التعبئة من مستند')}
            </label>
            <p className="mt-0.5 text-xs text-gray-500">
              {t('PDF, DOCX, PPTX, PNG, JPG or TXT, up to 16 MB.', 'PDF أو DOCX أو PPTX أو PNG أو JPG أو TXT، حتى 16 ميجابايت.')}
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id="framework-file"
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setMessage('');
                  setError('');
                }}
                className="block w-full min-w-0 rounded-lg border border-gray-300 bg-white p-2 text-sm"
              />
              <button
                type="button"
                disabled={!file || extracting}
                onClick={() => void extract()}
                className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-lg border border-[#C6A75D] bg-white px-4 py-2 text-sm font-semibold text-[#8A6D2F] hover:bg-[#FFF9F0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <DocumentArrowUpIcon className="h-5 w-5" />
                {extracting ? t('Reading…', 'جارٍ القراءة…') : t('Read document', 'قراءة المستند')}
              </button>
            </div>
            {form.sourceFilename && (
              <p className="mt-2 text-xs text-gray-500">
                {t('Source: ', 'المصدر: ')}<span className="font-medium text-gray-700">{form.sourceFilename}</span>
              </p>
            )}
          </div>

          {notes.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 rounded-lg bg-amber-50 p-3 ps-8 text-xs text-amber-800">
              {notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          )}

          <label className="mt-4 block text-sm font-semibold text-gray-800">
            {t('Name', 'الاسم')}
            <input
              value={form.name}
              maxLength={200}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className={inputClass}
            />
          </label>

          <label className="mt-4 block text-sm font-semibold text-gray-800">
            {t('Description', 'الوصف')}
            <textarea
              value={form.description}
              maxLength={2000}
              rows={2}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className={inputClass}
            />
          </label>

          <label className="mt-4 block text-sm font-semibold text-gray-800">
            {t('Applies to', 'ينطبق على')}
            <span className="mt-0.5 block text-xs font-normal text-gray-500">
              {t(
                'The RFP types, categories and keywords this framework is for. Used to pick it automatically.',
                'أنواع طلبات العروض وفئاتها والكلمات المفتاحية التي يخصها هذا الإطار. يُستخدم لاختياره تلقائياً.',
              )}
            </span>
            <textarea
              value={form.appliesTo}
              maxLength={2000}
              rows={3}
              onChange={(event) => setForm((current) => ({ ...current, appliesTo: event.target.value }))}
              className={inputClass}
            />
          </label>

          <label className="mt-4 block text-sm font-semibold text-gray-800">
            {t('Framework language', 'لغة الإطار')}
            <select
              value={form.language}
              onChange={(event) => setForm((current) => ({ ...current, language: event.target.value === 'ar' ? 'ar' : 'en' }))}
              className={inputClass}
            >
              <option value="en">{t('English', 'الإنجليزية')}</option>
              <option value="ar">{t('Arabic', 'العربية')}</option>
            </select>
          </label>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-gray-800">{t('Criteria', 'المعايير')}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${Math.abs(weightTotal - 100) <= 0.01 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}
                aria-live="polite"
              >
                {t(`Total weight: ${Math.round(weightTotal * 100) / 100} / 100`, `مجموع الأوزان: ${Math.round(weightTotal * 100) / 100} / 100`)}
              </span>
            </div>
            <div className="mt-2 space-y-3">
              {form.criteria.map((criterion, index) => (
                <div key={criterion.key} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 w-5 flex-shrink-0 text-center text-xs font-semibold text-gray-400">{index + 1}</span>
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_96px]">
                      <input
                        value={criterion.criterion}
                        maxLength={200}
                        placeholder={t('Criterion', 'المعيار')}
                        aria-label={t(`Criterion ${index + 1} name`, `اسم المعيار ${index + 1}`)}
                        onChange={(event) => updateCriterion(criterion.key, { criterion: event.target.value })}
                        className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#C6A75D] focus:ring-2 focus:ring-[#C6A75D]/20"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="any"
                          inputMode="decimal"
                          value={criterion.weight}
                          placeholder="0"
                          aria-label={t(`Criterion ${index + 1} weight`, `وزن المعيار ${index + 1}`)}
                          onChange={(event) => updateCriterion(criterion.key, { weight: event.target.value })}
                          className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#C6A75D] focus:ring-2 focus:ring-[#C6A75D]/20"
                        />
                        <span className="text-sm text-gray-400">%</span>
                      </div>
                      <textarea
                        value={criterion.guidance}
                        maxLength={2000}
                        rows={2}
                        placeholder={t('What earns a high score (optional)', 'ما الذي يستحق درجة عالية (اختياري)')}
                        aria-label={t(`Criterion ${index + 1} guidance`, `إرشادات المعيار ${index + 1}`)}
                        onChange={(event) => updateCriterion(criterion.key, { guidance: event.target.value })}
                        className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs outline-none focus:border-[#C6A75D] focus:ring-2 focus:ring-[#C6A75D]/20 sm:col-span-2"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={form.criteria.length <= 2}
                      onClick={() => setForm((current) => ({ ...current, criteria: current.criteria.filter((c) => c.key !== criterion.key) }))}
                      className="mt-1 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      aria-label={t(`Remove criterion ${index + 1}`, `إزالة المعيار ${index + 1}`)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={form.criteria.length >= 12}
              onClick={() => setForm((current) => ({ ...current, criteria: [...current.criteria, row()] }))}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#8A6D2F] hover:underline disabled:opacity-40"
            >
              <PlusIcon className="h-4 w-4" />
              {t('Add criterion', 'إضافة معيار')}
            </button>
          </div>

          {validationError && (form.name || filledCriteria.length > 0) && (
            <p className="mt-4 text-xs text-amber-700">{validationError}</p>
          )}

          <button
            disabled={saving || extracting || !!validationError}
            type="submit"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: themeColor }}
          >
            {saving
              ? t('Saving…', 'جارٍ الحفظ…')
              : form.id ? t('Save changes', 'حفظ التغييرات') : t('Save framework', 'حفظ الإطار')}
          </button>
        </form>
      </div>
    </div>
  );
};
