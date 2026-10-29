import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  FunnelIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { BackendService, InquiryAdminDocument } from '../services/backendService';

interface InquiryDocumentAdminProps {
  apiConfig: { baseUrl: string; headers?: Record<string, string> };
  isArabic: boolean;
  themeColor: string;
  variant?: 'header' | 'menu' | 'panel';
  onOpenAdminPanel?: () => void;
}

const allowedExtensions = /\.(pdf|docx|pptx)$/i;

export const InquiryDocumentAdmin: React.FC<InquiryDocumentAdminProps> = ({
  apiConfig,
  isArabic,
  themeColor,
  variant = 'header',
  onOpenAdminPanel,
}) => {
  const service = useMemo(
    () => new BackendService(apiConfig.baseUrl, apiConfig.headers),
    [apiConfig.baseUrl, JSON.stringify(apiConfig.headers ?? {})],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [embeddedContainer, setEmbeddedContainer] = useState<HTMLDivElement | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyDocumentId, setBusyDocumentId] = useState('');
  const [documents, setDocuments] = useState<InquiryAdminDocument[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [department, setDepartment] = useState('');
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const [languageFilter, setLanguageFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadAccess = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const result = await service.getInquiryAdminDocuments();
      setAuthorized(result.authorized);
      setDocuments(result.documents);
      setDepartments(result.departments);
      setDepartment((current) => current || result.departments[0] || '');
    } catch {
      setAuthorized(false);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  const filteredDocuments = useMemo(() => documents.filter((document) => {
    const matchesLanguage = !languageFilter || document.language === languageFilter;
    const matchesDepartment = !departmentFilter || document.department === departmentFilter;
    return matchesLanguage && matchesDepartment;
  }), [documents, languageFilter, departmentFilter]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!file || !allowedExtensions.test(file.name)) {
      setError(isArabic ? 'اختر ملف PDF أو DOCX أو PPTX.' : 'Select a PDF, DOCX, or PPTX file.');
      return;
    }
    if (!department) {
      setError(isArabic ? 'لم يتم العثور على إدارة مصرح بها.' : 'No authorized department was found.');
      return;
    }

    setSaving(true);
    try {
      await service.uploadInquiryDocument({
        file,
        department,
        language,
        title: file.name.replace(/\.[^.]+$/, ''),
        accessScope: 'department',
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessage(
        isArabic
          ? 'تم رفع المستند وحفظ اسمه وبياناته تلقائياً.'
          : 'Document uploaded. Its name and document details were saved automatically.',
      );
      await loadAccess(false);
    } catch (uploadError) {
      setError(isArabic ? 'تعذر رفع المستند. حاول مرة أخرى.' : 'Unable to upload the document. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const reupload = async (document: InquiryAdminDocument, replacementFile: File) => {
    if (!allowedExtensions.test(replacementFile.name)) {
      setError(isArabic ? 'اختر ملف PDF أو DOCX أو PPTX.' : 'Select a PDF, DOCX, or PPTX file.');
      return;
    }
    setBusyDocumentId(document.document_id);
    setMessage('');
    setError('');
    try {
      await service.uploadInquiryDocument({
        file: replacementFile,
        department: document.department,
        language: document.language === 'ar' ? 'ar' : 'en',
        title: replacementFile.name.replace(/\.[^.]+$/, ''),
        accessScope: document.access_scope || 'department',
        replaceDocumentId: document.document_id,
      });
      setMessage(isArabic ? 'تم رفع الإصدار الجديد وهو قيد المعالجة.' : 'New version uploaded and queued for processing.');
      await loadAccess(false);
    } catch (uploadError) {
      setError(isArabic ? 'تعذر رفع الإصدار الجديد. حاول مرة أخرى.' : 'Unable to upload the new version. Please try again.');
    } finally {
      setBusyDocumentId('');
    }
  };

  const download = async (document: InquiryAdminDocument) => {
    setBusyDocumentId(document.document_id);
    setMessage('');
    setError('');
    try {
      const blob = await service.downloadInquiryDocument(document.document_id);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.original_filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(isArabic ? 'تعذر تنزيل المستند. حاول مرة أخرى.' : 'Unable to download the document. Please try again.');
    } finally {
      setBusyDocumentId('');
    }
  };

  const remove = async (document: InquiryAdminDocument) => {
    const confirmed = window.confirm(
      isArabic
        ? `حذف ${document.title || document.original_filename} وجميع إصداراته نهائياً؟`
        : `Permanently delete ${document.title || document.original_filename} and all its versions?`,
    );
    if (!confirmed) return;

    setBusyDocumentId(document.document_id);
    setMessage('');
    setError('');
    try {
      await service.deleteInquiryDocument(document.document_id);
      setMessage(isArabic ? 'تم حذف المستند.' : 'Document deleted.');
      await loadAccess(false);
    } catch (deleteError) {
      setError(isArabic ? 'تعذر حذف المستند. حاول مرة أخرى.' : 'Unable to delete the document. Please try again.');
    } finally {
      setBusyDocumentId('');
    }
  };

  if (loading || !authorized) return null;

  const modalRoot = triggerRef.current?.getRootNode();
  const modalContainer =
    typeof ShadowRoot !== 'undefined' && modalRoot instanceof ShadowRoot
      ? modalRoot
      : document.body;

  return (
    <>
      {variant === 'panel' && (
        <div
          ref={setEmbeddedContainer}
          className="relative flex h-[calc(100vh-190px)] min-h-[620px] w-full overflow-hidden rounded-xl border border-[#EAECF0] bg-white"
        />
      )}
      {variant !== 'panel' && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            if (onOpenAdminPanel) {
              onOpenAdminPanel();
              return;
            }
            setOpen(true);
          }}
          className={
            variant === 'menu'
              ? 'w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-[#8A6D2F] hover:bg-[#FFF9F0] transition-colors'
              : 'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold bg-white hover:bg-[#FFFCF5] transition-colors'
          }
          style={variant === 'menu' ? undefined : { borderColor: themeColor, color: '#8A6D2F' }}
          title={isArabic ? 'رفع مستند استفسار' : 'Upload inquiry document'}
        >
          {variant === 'menu'
            ? <Cog6ToothIcon className="h-4 w-4" />
            : <DocumentTextIcon className="h-5 w-5" />}
          <span className={variant === 'menu' ? '' : 'hidden sm:inline'}>
            {variant === 'menu'
              ? isArabic ? 'لوحة الإدارة' : 'Admin Panel'
              : isArabic ? 'رفع مستند' : 'Upload document'}
          </span>
        </button>
      )}

      {(open || (variant === 'panel' && embeddedContainer)) && createPortal(
        <div className={
          variant === 'panel'
            ? 'absolute inset-0 flex bg-white'
            : 'fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4'
        }>
          <div
            dir={isArabic ? 'rtl' : 'ltr'}
            className={
              variant === 'panel'
                ? 'flex h-full min-h-0 w-full flex-col overflow-hidden bg-white'
                : 'flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl'
            }
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {isArabic ? 'مستندات الاستفسارات' : 'Inquiry documents'}
                </h2>
                <p className="text-sm text-gray-500">
                  {isArabic
                    ? 'اختر الملف وسيتم حفظ الاسم والإدارة وإعدادات الوصول تلقائياً.'
                    : 'Choose a file. Its name, department, and access settings are filled automatically.'}
                </p>
              </div>
              {variant !== 'panel' && (
                <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-gray-100">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="min-w-0">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                    {isArabic ? 'المستندات المرفوعة' : 'Uploaded documents'}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {isArabic ? `${filteredDocuments.length} من ${documents.length} مستند` : `${filteredDocuments.length} of ${documents.length} documents`}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#FFF9F0] px-2.5 py-1 text-xs font-semibold text-[#8A6D2F]">
                    {filteredDocuments.length}
                  </span>
                </div>

                <div className="mb-4 grid gap-3 rounded-xl border border-[#EAECF0] bg-[#F8FAFC] p-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">
                    <FunnelIcon className="h-4 w-4 text-[#8A6D2F]" />
                    {isArabic ? 'تصفية' : 'Filter'}
                  </div>
                  <select
                    value={languageFilter}
                    onChange={(event) => setLanguageFilter(event.target.value)}
                    className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#344054] outline-none transition focus:border-[#C6A75D] focus:ring-2 focus:ring-[#C6A75D]/20"
                    aria-label={isArabic ? 'تصفية حسب اللغة' : 'Filter by language'}
                  >
                    <option value="">{isArabic ? 'كل اللغات' : 'All languages'}</option>
                    <option value="en">{isArabic ? 'الإنجليزية' : 'English'}</option>
                    <option value="ar">{isArabic ? 'العربية' : 'Arabic'}</option>
                  </select>
                  <select
                    value={departmentFilter}
                    onChange={(event) => setDepartmentFilter(event.target.value)}
                    className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#344054] outline-none transition focus:border-[#C6A75D] focus:ring-2 focus:ring-[#C6A75D]/20"
                    aria-label={isArabic ? 'تصفية حسب الإدارة' : 'Filter by department'}
                  >
                    <option value="">{isArabic ? 'كل الإدارات' : 'All departments'}</option>
                    {departments.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  {filteredDocuments.length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                      {documents.length === 0
                        ? isArabic ? 'لم يتم رفع أي مستندات بعد.' : 'No documents have been uploaded yet.'
                        : isArabic ? 'لا توجد مستندات تطابق عوامل التصفية.' : 'No documents match these filters.'}
                    </div>
                  )}
                  {filteredDocuments.map((document) => {
                    const ready = document.status === 'ready' && document.stage === 'ready';
                    return (
                      <div key={document.document_id} className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#FFF9F0]">
                            <DocumentTextIcon className="h-5 w-5 text-[#8A6D2F]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-gray-900">
                              {document.title || document.original_filename}
                            </div>
                            <div className="mt-1 truncate text-xs text-gray-500">
                              {document.original_filename}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <span>{document.department}</span>
                              <span>·</span>
                              <span>{document.language === 'ar' ? (isArabic ? 'العربية' : 'Arabic') : (isArabic ? 'الإنجليزية' : 'English')}</span>
                              <span>·</span>
                              <span>{document.doc_version || `v${document.version_number || 1}`}</span>
                              {typeof document.progress_pct === 'number' && !ready && (
                                <><span>·</span><span>{document.progress_pct}%</span></>
                              )}
                            </div>
                          </div>
                          <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${ready ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                            {ready
                              ? isArabic ? 'جاهز' : 'Ready'
                              : isArabic ? 'قيد المعالجة' : 'Processing'}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
                          <button
                            type="button"
                            disabled={busyDocumentId === document.document_id}
                            onClick={() => void download(document)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            {isArabic ? 'تنزيل' : 'Download'}
                          </button>
                          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E8DDBF] bg-[#FFFCF5] px-3 py-2 text-xs font-semibold text-[#8A6D2F] hover:bg-[#F3E8CC] ${busyDocumentId === document.document_id ? 'pointer-events-none opacity-50' : ''}`}>
                            <ArrowPathIcon className="h-4 w-4" />
                            {isArabic ? 'إعادة الرفع' : 'Re-upload'}
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                              onChange={(event) => {
                                const replacementFile = event.target.files?.[0];
                                event.target.value = '';
                                if (replacementFile) void reupload(document, replacementFile);
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            disabled={busyDocumentId === document.document_id}
                            onClick={() => void remove(document)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            <TrashIcon className="h-4 w-4" />
                            {isArabic ? 'حذف' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <form onSubmit={submit} className="w-full rounded-xl border border-[#E8DDBF] bg-[#FFFCF5] p-5">
                <h3 className="mb-4 font-semibold text-gray-900">
                  {isArabic ? 'رفع مستند جديد' : 'Upload new document'}
                </h3>
                <label className="block text-sm font-semibold text-gray-800">
                  {isArabic ? 'اختر المستند' : 'Choose document'}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setMessage('');
                    setError('');
                  }}
                  className="mt-2 block w-full rounded-lg border border-gray-300 bg-white p-3 text-sm"
                />

                {departments.length > 1 && (
                  <>
                    <label className="mt-4 block text-sm font-semibold text-gray-800">
                      {isArabic ? 'الإدارة' : 'Department'}
                    </label>
                    <select
                      value={department}
                      onChange={(event) => setDepartment(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
                    >
                      {departments.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </>
                )}

                <label className="mt-4 block text-sm font-semibold text-gray-800">
                  {isArabic ? 'لغة المستند' : 'Document language'}
                </label>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value === 'ar' ? 'ar' : 'en')}
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="en">{isArabic ? 'الإنجليزية' : 'English'}</option>
                  <option value="ar">{isArabic ? 'العربية' : 'Arabic'}</option>
                </select>

                {file && (
                  <div className="mt-4 rounded-lg bg-white p-3 text-sm text-gray-600">
                    <span className="font-semibold text-gray-800">{file.name}</span>
                    <div className="mt-1 text-xs text-gray-500">
                      {isArabic ? 'سيتم استخدام اسم الملف كعنوان للمستند.' : 'The filename will be used as the document title.'}
                    </div>
                  </div>
                )}

                {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
                {message && <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>}

                <button
                  disabled={saving || !file}
                  type="submit"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#C6A75D] px-4 py-3 text-sm font-semibold text-white hover:bg-[#B8985A] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowUpTrayIcon className="h-5 w-5" />
                  {saving
                    ? isArabic ? 'جارٍ الرفع...' : 'Uploading...'
                    : isArabic ? 'رفع المستند' : 'Upload document'}
                </button>
              </form>
            </div>
          </div>
        </div>,
        variant === 'panel' ? embeddedContainer! : modalContainer,
      )}
    </>
  );
};
