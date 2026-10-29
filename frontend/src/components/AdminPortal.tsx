import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BellAlertIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';
import type { ThemeColors } from './WeaveAiChat';
import { InquiryDocumentAdmin } from './InquiryDocumentAdmin';
import { ProposalFrameworkAdmin } from './ProposalFrameworkAdmin';
import { ApiConfig } from '../models/startup';
import {
  ADMIN_AD_GROUPS,
  ADMIN_DEPARTMENTS,
  ADMIN_SERVICES,
  ADMIN_USERS,
  AdminExportFormat,
  AUDIT_DATE_RANGE_OPTIONS,
  AUDIT_EVENT_TYPE_LABELS,
  AUDIT_LOG,
  AuditDateRange,
  AuditEventType,
  AuditLogEntry,
  buildAdminOverviewExport,
  DEFAULT_TOKEN_ALERT_CONFIG,
  filterAuditLog,
  formatTokens,
  getActiveUsersCount,
  getAdGroupsForUser,
  getDepartmentLeaderboard,
  getGroupEnabledServiceCount,
  getOrgTokensUsed,
  getServiceLeaderboard,
  getServicesGrantedByAdGroups,
  getTotalOrgUsers,
  getUserLeaderboard,
  GOVERNANCE_KPIS,
  INITIAL_AD_GROUP_ACCESS,
  INITIAL_USER_ACCESS,
  ORG_TOKEN_LIMIT,
  TokenAlertConfig,
} from '../utils/adminPortalDemo';

interface AdminPortalProps {
  onClose: () => void;
  themeColors: ThemeColors;
  apiConfig: ApiConfig;
  isArabicLanguage?: boolean;
  currentUser?: {
    employee_name?: string;
    email?: string;
    department?: string;
  };
}

const AR = {
  title: 'لوحة إدارة الذكاء الاصطناعي',
  subtitle: 'إدارة الاستخدام والوصول للذكاء الاصطناعي',
  tokenAlerts: 'تنبيهات الرموز',
  exportReport: 'تصدير التقرير',
  backToChat: 'العودة للمحادثة',
  tabOverview: 'نظرة عامة',
  tabAccess: 'الوصول',
  tabActivity: 'النشاط',
  tabAlerts: 'التنبيهات',
  tabModels: 'النماذج',
  tabDocuments: 'المستندات',
  tabFrameworks: 'أطر التقييم',
  // Overview
  overviewTitle: 'نظرة عامة',
  overviewDesc: 'الاستخدام التقديري للشهر الحالي عبر المؤسسة.',
  services: 'الخدمات',
  servicesDetail: 'مفعّل',
  servicesSub: 'متاحة للموظفين',
  users: 'المستخدمون',
  usersDetail: 'إجمالي',
  activeUsers: 'المستخدمون النشطون',
  activeUsersSub: 'استخدموا الذكاء الاصطناعي خلال 30 يومًا',
  tokenUsage: 'استخدام الرموز',
  configAlerts: 'ضبط تنبيهات البريد',
  governance: 'الحوكمة',
  governanceDesc: 'أحداث الوصول والامتثال هذا الشهر',
  viewActivityLog: 'عرض سجل النشاط',
  accessDenied: 'الوصول المرفوض',
  accessDeniedSub: 'محاولات خدمة غير مصرح بها',
  permissionChanges: 'تغييرات الصلاحيات',
  permissionChangesSub: 'المنح والإلغاءات',
  dataExports: 'تصدير البيانات',
  dataExportsSub: 'التنزيلات من خدمات الذكاء الاصطناعي',
  sharingActivities: 'أنشطة المشاركة',
  sharingActivitiesSub: 'مشاركة المساحة والمحادثات',
  thisMonth: 'هذا الشهر',
  userLeaderboard: 'قائمة المستخدمين',
  userLeaderboardDesc: 'أعلى استخدام تقديري للرموز هذا الشهر',
  tokens: 'الرموز',
  serviceUsage: 'استخدام الخدمات',
  serviceUsageDesc: 'أكثر خدمات الذكاء الاصطناعي استخدامًا هذا الشهر',
  deptUsage: 'استخدام الأقسام',
  deptUsageDesc: 'الرموز مقابل الحدود الشهرية للأقسام',
  // Alerts
  alertsTitle: 'تنبيهات رموز البريد الإلكتروني',
  alertsDesc: 'ضبط حدود الاستهلاك ومن يتلقى الإشعارات عند الاقتراب من الحدود.',
  enableAlerts: 'تفعيل تنبيهات البريد',
  enableAlertsSub: 'إرسال إشعارات عند تجاوز حدود استخدام الرموز',
  warningThreshold: 'حد التحذير',
  criticalThreshold: 'الحد الحرج',
  emailRecipients: 'مستلمو البريد',
  emailRecipientsSub: 'عناوين بريد وزارة المالية مفصولة بفواصل',
  dailyDigest: 'ملخص يومي',
  dailyDigestSub: 'تضمين ملخص صباحي لاستهلاك الرموز',
  saveAlerts: 'حفظ إعدادات التنبيهات',
  backToOverview: 'العودة للنظرة العامة',
  settingsSaved: 'تم الحفظ',
  // Access
  accessTitle: 'الوصول',
  accessDesc: 'منح أو إلغاء خدمات الذكاء الاصطناعي عبر مجموعات Active Directory (موصى به) أو تجاوزات المستخدمين الفردية.',
  adGroups: 'مجموعات AD',
  adGroupsTitle: 'مجموعات Active Directory',
  searchGroupDn: 'البحث باسم المجموعة أو DN',
  noGroupsFound: 'لم يتم العثور على مجموعات',
  members: 'الأعضاء',
  ofEnabled: 'من',
  enabled: 'ممكّن',
  grantedVia: 'تم المنح عبر',
  revokedVia: 'تم الإلغاء عبر',
  grantingNote: 'منح أو إلغاء خدمة يحدّث الوصول لجميع أعضاء مجموعة AD هذه.',
  usersTitle: 'المستخدمون',
  searchUserDept: 'البحث بالاسم أو القسم',
  noUsersFound: 'لم يتم العثور على مستخدمين',
  employees: 'موظفون',
  memberOfAdGroups: 'عضو في مجموعات AD',
  adGroupsNote: 'يُفضّل الإلغاء عبر مجموعات AD لمواءمة العضوية مع Active Directory.',
  accessGranted: 'تم منح الوصول',
  accessRevoked: 'تم إلغاء الوصول',
  userOverride: 'تجاوز المستخدم',
  // Models
  modelsTitle: 'النماذج',
  modelsDesc: 'اختر نموذج الذكاء الاصطناعي النشط لكل نوع من القدرات المستخدمة عبر الخدمات.',
  multimodalLabel: 'النموذج متعدد الوسائط',
  multimodalDesc: 'يُستخدم لتحليل المرئيات والمستندات والمهام المدمجة للنص والصور.',
  voiceLabel: 'نموذج الصوت',
  voiceDesc: 'يُستخدم لتحويل الكلام إلى نص في ملخصات الاجتماعات والإدخال الصوتي.',
  textLabel: 'نموذج النص',
  textDesc: 'يُستخدم للمحادثة العامة والأسئلة والأجوبة وتوليد النص الخفيف.',
  arabicLabel: 'النموذج العربي',
  arabicDesc: 'يُستخدم عند تفعيل اللغة العربية للحصول على ردود مراعية للسياق الثقافي.',
  recommended: 'موصى به',
  nonRecommendedWarning: 'لقد اخترت نموذجًا غير موصى به. قد يؤثر ذلك على جودة الردود ودقتها وأداء الخدمة. قم بالتغيير فقط إذا كنت متأكدًا من أنه يلبي متطلباتك.',
  saveModels: 'حفظ إعدادات النماذج',
  confirmTitle: 'حفظ إعدادات النماذج؟',
  confirmDesc: 'قد يؤدي تغيير نماذج الذكاء الاصطناعي إلى تعطيل أو التأثير على جودة الخدمات النشطة. قد يواجه المستخدمون سلوكًا مختلفًا في الردود حتى تعمل النماذج الجديدة بكفاءة كاملة.',
  confirmQuestion: 'هل أنت متأكد من الاستمرار؟',
  cancel: 'إلغاء',
  yesSave: 'نعم، احفظ الإعدادات',
  // Activity
  activityTitle: 'النشاط',
  activityDesc: 'سجل المراجعة — مستندات المصدر، والتصدير، والمشاركة، والصلاحيات، وحدود الرموز، والإجراءات الإدارية.',
  auditLog: 'سجل المراجعة',
  auditLogDesc: 'يعرض من أصل حدث',
  resetFilters: 'إعادة تعيين المرشحات',
  searchAudit: 'البحث في سجل المراجعة…',
  allUsers: 'جميع المستخدمين',
  allDepts: 'جميع الأقسام',
  allServices: 'جميع الخدمات',
  allEventTypes: 'جميع أنواع الأحداث',
  noAuditEvents: 'لا توجد أحداث مراجعة تطابق المرشحات الحالية.',
  colTimestamp: 'الوقت',
  colUser: 'المستخدم',
  colDept: 'القسم',
  colService: 'الخدمة',
  colEventType: 'نوع الحدث',
  colTokens: 'الرموز',
  colEvent: 'الحدث',
};

type DashboardTab = 'overview' | 'access' | 'activity' | 'alerts' | 'models' | 'documents' | 'frameworks';

const MODEL_OPTIONS: Record<string, { value: string; label: string; recommended?: boolean }[]> = {
  multimodal: [
    { value: 'gpt-4.1',  label: 'GPT-4.1' },
    { value: 'gpt-5.4',  label: 'GPT-5.4', recommended: true },
    { value: 'gpt-5.3',  label: 'GPT-5.3' },
    { value: 'gpt-4o',   label: 'GPT-4o' },
  ],
  voice: [
    { value: 'whisper-1', label: 'Whisper', recommended: true },
  ],
  text: [
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 mini', recommended: true },
  ],
  arabic: [
    { value: 'seraj', label: 'Seraj', recommended: true },
    { value: 'jais',  label: 'Jais' },
  ],
};

type ModelKey = keyof typeof MODEL_OPTIONS;

const RECOMMENDED_MODELS: Record<ModelKey, string> = {
  multimodal: 'gpt-5.4',
  voice:      'whisper-1',
  text:       'gpt-5.4-mini',
  arabic:     'seraj',
};
type AccessScope = 'users' | 'ad-groups';

const RANK_STYLES = ['text-[#B68A35]', 'text-[#98A2B3]', 'text-[#CD7F32]'];

function StatCard({
  label,
  value,
  sub,
  detail,
  action,
}: {
  label: string;
  value: string;
  sub?: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-[#667085]">{label}</p>
        {detail && <span className="text-[11px] text-[#98A2B3]">{detail}</span>}
      </div>
      <p className="text-[28px] font-semibold tracking-[-0.03em] text-[#101828]">{value}</p>
      {sub && <p className="mt-1 text-xs text-[#98A2B3]">{sub}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

function downloadBlob(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  onClose,
  themeColors,
  apiConfig,
  isArabicLanguage = false,
  currentUser,
}) => {
  // Inline translation helper
  const a = (en: string, arKey: keyof typeof AR) => isArabicLanguage ? AR[arKey] : en;
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [accessScope, setAccessScope] = useState<AccessScope>('ad-groups');
  const [selectedUserId, setSelectedUserId] = useState(ADMIN_USERS[0].id);
  const [selectedGroupId, setSelectedGroupId] = useState(ADMIN_AD_GROUPS[0].id);
  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [userAccess, setUserAccess] = useState(INITIAL_USER_ACCESS);
  const [groupAccess, setGroupAccess] = useState(INITIAL_AD_GROUP_ACCESS);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(AUDIT_LOG);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState<TokenAlertConfig>(DEFAULT_TOKEN_ALERT_CONFIG);
  const [alertSaved, setAlertSaved] = useState(false);
  const [selectedModels, setSelectedModels] = useState<Record<ModelKey, string>>({
    multimodal: 'gpt-5.4',
    voice:      'whisper-1',
    text:       'gpt-5.4-mini',
    arabic:     'seraj',
  });
  const [modelsSaved, setModelsSaved] = useState(false);
  const [modelsConfirmOpen, setModelsConfirmOpen] = useState(false);

  const saveModels = () => {
    setModelsConfirmOpen(false);
    setModelsSaved(true);
    setAuditLog(prev => [{
      id: `models-${Date.now()}`,
      timestamp: formatAuditNow(),
      userId: 'admin',
      userName: currentUser?.employee_name || 'Administrator',
      department: currentUser?.department || '—',
      service: 'Model configuration',
      tokens: 0,
      event: `Administrative action — model selections updated`,
      eventType: 'admin_action' as AuditEventType,
    }, ...prev].slice(0, 40));
    window.setTimeout(() => setModelsSaved(false), 2500);
  };
  const [auditSearch, setAuditSearch] = useState('');
  const [auditUser, setAuditUser] = useState('all');
  const [auditDepartment, setAuditDepartment] = useState('all');
  const [auditService, setAuditService] = useState('all');
  const [auditEventType, setAuditEventType] = useState<AuditEventType | 'all'>('all');
  const [auditDateRange, setAuditDateRange] = useState<AuditDateRange>('30d');
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const orgTokensUsed = useMemo(() => getOrgTokensUsed(), []);
  const orgUsagePercent = Math.round((orgTokensUsed / ORG_TOKEN_LIMIT) * 100);
  const totalUsers = getTotalOrgUsers();
  const activeUsers = getActiveUsersCount();
  const userLeaderboard = useMemo(() => getUserLeaderboard(), []);
  const serviceLeaderboard = useMemo(() => getServiceLeaderboard(), []);
  const departmentLeaderboard = useMemo(() => getDepartmentLeaderboard(), []);
  const maxUserTokens = userLeaderboard[0]?.tokensUsed ?? 1;
  const maxServiceTokens = serviceLeaderboard[0]?.tokens ?? 1;

  const auditUserOptions = useMemo(
    () => Array.from(new Set(auditLog.map(e => e.userName))).sort(),
    [auditLog],
  );
  const auditDepartmentOptions = useMemo(
    () => Array.from(new Set(auditLog.map(e => e.department).filter(d => d && d !== '—'))).sort(),
    [auditLog],
  );
  const auditServiceOptions = useMemo(
    () => Array.from(new Set(auditLog.map(e => e.service).filter(s => s && s !== '—'))).sort(),
    [auditLog],
  );
  const filteredAuditLog = useMemo(
    () => filterAuditLog(auditLog, {
      search: auditSearch,
      user: auditUser,
      department: auditDepartment,
      service: auditService,
      eventType: auditEventType,
      dateRange: auditDateRange,
    }),
    [auditLog, auditSearch, auditUser, auditDepartment, auditService, auditEventType, auditDateRange],
  );

  const clearAuditFilters = () => {
    setAuditSearch('');
    setAuditUser('all');
    setAuditDepartment('all');
    setAuditService('all');
    setAuditEventType('all');
    setAuditDateRange('30d');
  };

  const selectedUser = ADMIN_USERS.find(u => u.id === selectedUserId) ?? ADMIN_USERS[0];
  const selectedGroup = ADMIN_AD_GROUPS.find(g => g.id === selectedGroupId) ?? ADMIN_AD_GROUPS[0];
  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return ADMIN_USERS;
    return ADMIN_USERS.filter(
      u =>
        u.name.toLowerCase().includes(query) ||
        u.department.toLowerCase().includes(query),
    );
  }, [userSearch]);

  const filteredGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    if (!query) return ADMIN_AD_GROUPS;
    return ADMIN_AD_GROUPS.filter(
      g =>
        g.name.toLowerCase().includes(query) ||
        g.description.toLowerCase().includes(query) ||
        g.distinguishedName.toLowerCase().includes(query),
    );
  }, [groupSearch]);

  const selectedUserAdGroups = useMemo(
    () => getAdGroupsForUser(selectedUserId),
    [selectedUserId],
  );
  const servicesViaAdGroups = useMemo(
    () => getServicesGrantedByAdGroups(selectedUserId, groupAccess),
    [selectedUserId, groupAccess],
  );

  const getEnabledServiceCount = (userId: string) =>
    ADMIN_SERVICES.filter(s => userAccess[userId]?.[s.id]).length;

  const formatAuditNow = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  const toggleServiceAccess = (serviceId: string) => {
    const enabled = !(userAccess[selectedUserId]?.[serviceId] ?? false);
    const serviceName = ADMIN_SERVICES.find(s => s.id === serviceId)?.name ?? serviceId;

    setUserAccess(prev => ({
      ...prev,
      [selectedUserId]: { ...prev[selectedUserId], [serviceId]: enabled },
    }));

    setAuditLog(prev => [{
      id: `local-${Date.now()}`,
      timestamp: formatAuditNow(),
      userId: 'admin',
      userName: currentUser?.employee_name || 'Administrator',
      department: selectedUser.department,
      service: serviceName,
      tokens: 0,
      event: enabled
        ? `Access granted (user override) — ${selectedUser.name}`
        : `Access revoked (user override) — ${selectedUser.name}`,
      eventType: 'permission_change' as const,
    }, ...prev].slice(0, 40));
  };

  const toggleGroupServiceAccess = (serviceId: string) => {
    const enabled = !(groupAccess[selectedGroupId]?.[serviceId] ?? false);
    const serviceName = ADMIN_SERVICES.find(s => s.id === serviceId)?.name ?? serviceId;
    const members = selectedGroup.memberUserIds;

    setGroupAccess(prev => ({
      ...prev,
      [selectedGroupId]: { ...prev[selectedGroupId], [serviceId]: enabled },
    }));

    // Propagate AD group grant/revoke to all group members
    setUserAccess(prev => {
      const next = { ...prev };
      members.forEach(userId => {
        next[userId] = { ...next[userId], [serviceId]: enabled };
      });
      return next;
    });

    setAuditLog(prev => [{
      id: `adg-${Date.now()}`,
      timestamp: formatAuditNow(),
      userId: 'admin',
      userName: currentUser?.employee_name || 'Administrator',
      department: '—',
      service: serviceName,
      tokens: 0,
      event: enabled
        ? `Access granted via AD group ${selectedGroup.name} (${members.length} members)`
        : `Access revoked via AD group ${selectedGroup.name} (${members.length} members)`,
      eventType: 'permission_change' as const,
    }, ...prev].slice(0, 40));
  };

  const handleExport = (format: AdminExportFormat) => {
    const file = buildAdminOverviewExport(format, {
      orgTokensUsed,
      orgLimit: ORG_TOKEN_LIMIT,
      totalUsers,
      activeUsers,
      serviceCount: ADMIN_SERVICES.length,
      governance: GOVERNANCE_KPIS,
      alertConfig,
    });
    downloadBlob(file.filename, file.mimeType, file.content);
    setExportOpen(false);
    setExportNotice(
      format === 'pdf'
        ? 'Report downloaded (PDF-ready text).'
        : format === 'excel'
          ? 'Excel report downloaded.'
          : 'CSV report downloaded.',
    );
    window.setTimeout(() => setExportNotice(null), 2800);
  };

  const saveAlertConfig = () => {
    setAlertSaved(true);
    setAuditLog(prev => [{
      id: `alert-${Date.now()}`,
      timestamp: formatAuditNow(),
      userId: 'admin',
      userName: currentUser?.employee_name || 'Administrator',
      department: currentUser?.department || '—',
      service: 'Token alerts',
      tokens: 0,
      event: `Administrative action — alert thresholds updated (${alertConfig.warningPercent}% / ${alertConfig.criticalPercent}%)`,
      eventType: 'admin_action' as const,
    }, ...prev].slice(0, 40));
    window.setTimeout(() => setAlertSaved(false), 2500);
  };

  const tabs: { id: DashboardTab; label: string }[] = [
    { id: 'overview',  label: a('Overview',  'tabOverview') },
    { id: 'access',    label: a('Access',    'tabAccess') },
    { id: 'activity',  label: a('Activity',  'tabActivity') },
    { id: 'alerts',    label: a('Alerts',    'tabAlerts') },
    { id: 'models',    label: a('Models',    'tabModels') },
    { id: 'documents', label: a('Documents', 'tabDocuments') },
    { id: 'frameworks', label: a('Evaluation frameworks', 'tabFrameworks') },
  ];

  return (
    <div
      dir={isArabicLanguage ? 'rtl' : 'ltr'}
      className="flex-1 flex flex-col min-h-0 bg-[#F8F8F7] overflow-hidden"
    >
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-[#EAECF0] px-6">
        <div className={twMerge('mx-auto w-full', activeTab === 'overview' || activeTab === 'alerts' ? 'max-w-[1160px]' : 'max-w-none')}>
          <div className={twMerge('flex items-center justify-between gap-4 py-5', isArabicLanguage && 'flex-row-reverse')}>
            <div className={twMerge('flex items-center gap-3 min-w-0', isArabicLanguage && 'flex-row-reverse')}>
              <button
                onClick={onClose}
                className={twMerge('p-2 rounded-lg hover:bg-[#F5F5F4] transition-colors flex-shrink-0', isArabicLanguage ? '-mr-2' : '-ml-2')}
                title={a('Back to chat', 'backToChat')}
              >
                {isArabicLanguage
                  ? <ArrowRightIcon className="w-5 h-5 text-gray-600" />
                  : <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
                }
              </button>
              <div className={isArabicLanguage ? 'text-right' : ''}>
                <h1 className="text-xl font-semibold tracking-[-0.02em] text-[#101828]">{a('AI Admin Panel', 'title')}</h1>
                <p className="mt-0.5 text-xs text-[#667085]">{a('AI usage and access management', 'subtitle')}</p>
              </div>
            </div>

            <div className={twMerge('flex items-center gap-2 flex-shrink-0', isArabicLanguage && 'flex-row-reverse')}>
              <button
                type="button"
                onClick={() => setActiveTab('alerts')}
                className={twMerge('inline-flex items-center gap-1.5 rounded-lg border border-[#EAECF0] bg-white px-3 py-2 text-xs font-medium text-[#344054] hover:bg-[#FAFAFA] transition-colors', isArabicLanguage && 'flex-row-reverse')}
              >
                <BellAlertIcon className="w-4 h-4" style={{ color: themeColors.primary }} />
                {a('Token alerts', 'tokenAlerts')}
              </button>

              <div className="relative" ref={exportMenuRef}>
                <button
                  type="button"
                  onClick={() => setExportOpen(open => !open)}
                  className={twMerge('inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90', isArabicLanguage && 'flex-row-reverse')}
                  style={{ backgroundColor: themeColors.primary }}
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  {a('Export report', 'exportReport')}
                  <ChevronDownIcon className="w-3.5 h-3.5 opacity-80" />
                </button>
                {exportOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-10 cursor-default"
                      aria-label="Close export menu"
                      onClick={() => setExportOpen(false)}
                    />
                    <div className={twMerge('absolute z-20 mt-1.5 w-44 overflow-hidden rounded-lg border border-[#EAECF0] bg-white shadow-lg', isArabicLanguage ? 'left-0' : 'right-0')}>
                      {([
                        { id: 'pdf' as const, label: 'PDF' },
                        { id: 'excel' as const, label: 'Excel' },
                        { id: 'csv' as const, label: 'CSV' },
                      ]).map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleExport(opt.id)}
                          className={twMerge('block w-full px-3 py-2.5 text-sm text-[#344054] hover:bg-[#FAFAFA]', isArabicLanguage ? 'text-right' : 'text-left')}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {exportNotice && (
            <p className={twMerge('pb-2 text-xs font-medium', isArabicLanguage && 'text-right')} style={{ color: themeColors.primary }}>
              {exportNotice}
            </p>
          )}

          <nav className={twMerge('flex gap-6', isArabicLanguage && 'flex-row-reverse')}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={twMerge(
                  'relative pb-3 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'text-[#101828]'
                    : 'text-[#98A2B3] hover:text-[#475467]',
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ backgroundColor: themeColors.primary }}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        {activeTab !== 'documents' && activeTab !== 'frameworks' && (
          <p role="note" className="mx-auto mb-5 max-w-[1160px] rounded-lg border border-[#E8DEC8] bg-[#FFFCF5] px-4 py-3 text-sm text-[#80652E]">
            {isArabicLanguage
              ? 'تستخدم هذه الشاشة بيانات تجريبية، ولا تغيّر إعداداتها النظام الفعلي. تتصل شاشتا المستندات وأطر التقييم بالخدمات الخلفية.'
              : 'This screen uses demo data, and its settings do not change the live system. Documents and Evaluation frameworks connect to the backend.'}
          </p>
        )}
        <div className={twMerge(
          'mx-auto w-full',
          activeTab === 'overview' || activeTab === 'alerts' ? 'max-w-[1160px]' : 'max-w-none',
        )}>

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className={isArabicLanguage ? 'text-right' : ''}>
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-[#101828]">{a('Overview', 'overviewTitle')}</h2>
                <p className="mt-1 text-sm text-[#667085]">{a('Current month estimated usage across the organization.', 'overviewDesc')}</p>
              </div>

              {/* Usage KPI row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-[#EAECF0] overflow-hidden rounded-xl border border-[#EAECF0] bg-white">
                <StatCard
                  label={a('Services', 'services')}
                  value={String(ADMIN_SERVICES.length)}
                  sub={a('Available to employees', 'servicesSub')}
                  detail={a('Enabled', 'servicesDetail')}
                />
                <StatCard
                  label={a('Users', 'users')}
                  value={String(totalUsers)}
                  sub={`${ADMIN_DEPARTMENTS.length} ${isArabicLanguage ? 'أقسام' : 'departments'}`}
                  detail={a('Total', 'usersDetail')}
                />
                <StatCard
                  label={a('Active Users', 'activeUsers')}
                  value={String(activeUsers)}
                  sub={a('Used AI in the last 30 days', 'activeUsersSub')}
                  detail={`${Math.round((activeUsers / totalUsers) * 100)}%`}
                />
                <StatCard
                  label={a('Token Usage', 'tokenUsage')}
                  value={formatTokens(orgTokensUsed)}
                  sub={isArabicLanguage ? `من ${formatTokens(ORG_TOKEN_LIMIT)} الحد الشهري` : `of ${formatTokens(ORG_TOKEN_LIMIT)} monthly limit`}
                  detail={`${orgUsagePercent}%`}
                  action={(
                    <button
                      type="button"
                      onClick={() => setActiveTab('alerts')}
                      className="text-[11px] font-medium underline-offset-2 hover:underline"
                      style={{ color: themeColors.primary }}
                    >
                      {a('Configure email alerts', 'configAlerts')}
                    </button>
                  )}
                />
              </div>

              {/* Governance KPI row */}
              <div>
                <div className={twMerge('mb-3 flex items-end justify-between gap-3', isArabicLanguage && 'flex-row-reverse')}>
                  <div className={isArabicLanguage ? 'text-right' : ''}>
                    <h3 className="text-sm font-semibold text-[#101828]">{a('Governance', 'governance')}</h3>
                    <p className="mt-0.5 text-xs text-[#98A2B3]">{a('Platform access and compliance events this month', 'governanceDesc')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('activity')}
                    className="text-[11px] font-medium text-[#667085] hover:text-[#344054]"
                  >
                    {a('View activity log', 'viewActivityLog')}
                  </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-[#EAECF0] overflow-hidden rounded-xl border border-[#EAECF0] bg-white">
                  <StatCard
                    label={a('Access Denied', 'accessDenied')}
                    value={String(GOVERNANCE_KPIS.accessDenied)}
                    sub={a('Unauthorized service attempts', 'accessDeniedSub')}
                    detail={a('This month', 'thisMonth')}
                  />
                  <StatCard
                    label={a('Permission Changes', 'permissionChanges')}
                    value={String(GOVERNANCE_KPIS.permissionChanges)}
                    sub={a('Grants and revocations', 'permissionChangesSub')}
                    detail={a('This month', 'thisMonth')}
                  />
                  <StatCard
                    label={a('Data Exports', 'dataExports')}
                    value={String(GOVERNANCE_KPIS.dataExports)}
                    sub={a('Downloads from AI services', 'dataExportsSub')}
                    detail={a('This month', 'thisMonth')}
                  />
                  <StatCard
                    label={a('Sharing Activities', 'sharingActivities')}
                    value={String(GOVERNANCE_KPIS.sharingActivities)}
                    sub={a('Workspace and chat shares', 'sharingActivitiesSub')}
                    detail={a('This month', 'thisMonth')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6">
                {/* User leaderboard */}
                <section className="bg-white rounded-xl border border-[#EAECF0]">
                  <div className={twMerge('flex items-center justify-between border-b border-[#EAECF0] px-5 py-4', isArabicLanguage && 'flex-row-reverse')}>
                    <div className={isArabicLanguage ? 'text-right' : ''}>
                      <h2 className="text-sm font-semibold text-[#101828]">{a('User leaderboard', 'userLeaderboard')}</h2>
                      <p className="mt-0.5 text-xs text-[#98A2B3]">{a('Highest estimated token usage this month', 'userLeaderboardDesc')}</p>
                    </div>
                    <span className="text-xs text-[#98A2B3]">{a('Tokens', 'tokens')}</span>
                  </div>
                  <div className="divide-y divide-[#F2F4F7]">
                    {userLeaderboard.map((user, i) => {
                      const pct = Math.round((user.tokensUsed / maxUserTokens) * 100);
                      return (
                        <div key={user.id} className={twMerge('flex items-center gap-3 px-5 py-3', isArabicLanguage && 'flex-row-reverse')}>
                          <span className={twMerge('w-5 text-xs font-semibold text-center flex-shrink-0', RANK_STYLES[i] ?? 'text-[#D0D5DD]')}>
                            {i + 1}
                          </span>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[#475467] text-xs font-semibold flex-shrink-0 bg-[#F2F4F7]">
                            {user.name.charAt(0)}
                          </div>
                          <div className={twMerge('flex-1 min-w-0', isArabicLanguage && 'text-right')}>
                            <p className="text-sm font-medium text-[#344054] truncate">{user.name}</p>
                            <p className="mt-0.5 text-[11px] text-[#98A2B3] truncate">{user.department} · {user.sessions} {isArabicLanguage ? 'جلسات' : 'sessions'}</p>
                          </div>
                          <div className={twMerge('w-24 flex-shrink-0', isArabicLanguage ? 'text-left' : 'text-right')}>
                            <p className="text-sm font-semibold text-[#344054]">{formatTokens(user.tokensUsed)}</p>
                            <div className="mt-1.5 h-1 bg-[#F2F4F7] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: themeColors.primary }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="bg-white rounded-xl border border-[#EAECF0]">
                  <div className={isArabicLanguage ? 'border-b border-[#EAECF0] px-5 py-4 text-right' : 'border-b border-[#EAECF0] px-5 py-4'}>
                    <h2 className="text-sm font-semibold text-[#101828]">{a('Service usage', 'serviceUsage')}</h2>
                    <p className="mt-0.5 text-xs text-[#98A2B3]">{a('Most-used AI services this month', 'serviceUsageDesc')}</p>
                  </div>
                  <div className="divide-y divide-[#F2F4F7]">
                    {serviceLeaderboard.slice(0, 5).map((svc) => {
                      const pct = Math.round((svc.tokens / maxServiceTokens) * 100);
                      return (
                        <div key={svc.serviceId} className="px-5 py-3">
                          <div className={twMerge('flex items-end justify-between gap-3', isArabicLanguage && 'flex-row-reverse')}>
                            <div className={twMerge('min-w-0', isArabicLanguage && 'text-right')}>
                              <p className="text-sm font-medium text-[#344054] truncate">{svc.name}</p>
                              <p className="mt-0.5 text-[11px] text-[#98A2B3]">{svc.invocations.toLocaleString()} {isArabicLanguage ? 'طلب' : 'requests'} · {svc.activeUsers} {isArabicLanguage ? 'مستخدم' : 'users'}</p>
                            </div>
                            <span className="text-xs font-semibold text-[#344054] whitespace-nowrap">{formatTokens(svc.tokens)}</span>
                          </div>
                          <div className="mt-2 h-1 bg-[#F2F4F7] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: themeColors.secondary }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* Department breakdown */}
              <section className="bg-white rounded-xl border border-[#EAECF0]">
                <div className={isArabicLanguage ? 'border-b border-[#EAECF0] px-5 py-4 text-right' : 'border-b border-[#EAECF0] px-5 py-4'}>
                  <h2 className="text-sm font-semibold text-[#101828]">{a('Department usage', 'deptUsage')}</h2>
                  <p className="mt-0.5 text-xs text-[#98A2B3]">{a('Tokens against monthly department limits', 'deptUsageDesc')}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#EAECF0]">
                  {departmentLeaderboard.map((dept) => {
                    const pct = Math.round((dept.tokensUsed / dept.tokenLimit) * 100);
                    return (
                      <div key={dept.id} className="p-4">
                        <p className="min-h-[34px] text-xs font-medium leading-4 text-[#475467]">{dept.name}</p>
                        <p className="mt-3 text-lg font-semibold text-[#101828]">
                          {formatTokens(dept.tokensUsed)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#98A2B3]">{dept.userCount} users · {pct}%</p>
                        <div className="h-1.5 bg-[#EAECF0] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              backgroundColor: pct >= 75 ? '#F04438' : themeColors.primary,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <p className="text-[11px] text-[#98A2B3] pb-2">
                Export reports from this dashboard, or manage deeper compliance trails in Compass Administrator Platform.
              </p>
            </div>
          )}

          {/* ── ALERTS ── */}
          {activeTab === 'alerts' && (
            <div className="space-y-6">
              <div className={isArabicLanguage ? 'text-right' : ''}>
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-[#101828]">{a('Token email alerts', 'alertsTitle')}</h2>
                <p className="mt-1 text-sm text-[#667085]">
                  {a('Configure consumption thresholds and who receives email notifications when limits are approached.', 'alertsDesc')}
                </p>
              </div>

              <section className="bg-white rounded-xl border border-[#EAECF0] p-6 space-y-6 max-w-2xl">
                <div className={twMerge('flex items-center justify-between gap-4', isArabicLanguage && 'flex-row-reverse')}>
                  <div className={isArabicLanguage ? 'text-right' : ''}>
                    <p className="text-sm font-semibold text-[#101828]">{a('Enable email alerts', 'enableAlerts')}</p>
                    <p className="mt-0.5 text-xs text-[#98A2B3]">{a('Send notifications when org token usage crosses thresholds', 'enableAlertsSub')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAlertConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                    className={twMerge(
                      'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                      !alertConfig.enabled && 'bg-[#D0D5DD]',
                    )}
                    style={alertConfig.enabled ? { backgroundColor: themeColors.primary } : undefined}
                    aria-label="Toggle email alerts"
                  >
                    <span className={twMerge(
                      'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                      alertConfig.enabled ? 'translate-x-5' : 'translate-x-0',
                    )} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className={twMerge('text-xs font-medium text-[#667085]', isArabicLanguage && 'block text-right')}>{a('Warning threshold', 'warningThreshold')}</span>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="number"
                        min={50}
                        max={99}
                        disabled={!alertConfig.enabled}
                        value={alertConfig.warningPercent}
                        onChange={e => setAlertConfig(prev => ({
                          ...prev,
                          warningPercent: Math.min(99, Math.max(50, Number(e.target.value) || 80)),
                        }))}
                        className="w-full rounded-lg border border-[#EAECF0] bg-[#FAFAFA] px-3 py-2 text-sm text-[#344054] focus:outline-none focus:ring-2 focus:ring-[#B68A35]/40 disabled:opacity-50"
                      />
                      <span className="text-sm text-[#98A2B3]">%</span>
                    </div>
                  </label>
                  <label className="block">
                    <span className={twMerge('text-xs font-medium text-[#667085]', isArabicLanguage && 'block text-right')}>{a('Critical threshold', 'criticalThreshold')}</span>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="number"
                        min={51}
                        max={100}
                        disabled={!alertConfig.enabled}
                        value={alertConfig.criticalPercent}
                        onChange={e => setAlertConfig(prev => ({
                          ...prev,
                          criticalPercent: Math.min(100, Math.max(51, Number(e.target.value) || 95)),
                        }))}
                        className="w-full rounded-lg border border-[#EAECF0] bg-[#FAFAFA] px-3 py-2 text-sm text-[#344054] focus:outline-none focus:ring-2 focus:ring-[#B68A35]/40 disabled:opacity-50"
                      />
                      <span className="text-sm text-[#98A2B3]">%</span>
                    </div>
                  </label>
                </div>

                <label className="block">
                  <span className={twMerge('text-xs font-medium text-[#667085]', isArabicLanguage && 'block text-right')}>{a('Email recipients', 'emailRecipients')}</span>
                  <input
                    type="text"
                    disabled={!alertConfig.enabled}
                    value={alertConfig.recipients}
                    onChange={e => setAlertConfig(prev => ({ ...prev, recipients: e.target.value }))}
                    placeholder="admin@mof.gov.ae, ops@mof.gov.ae"
                    className="mt-1.5 w-full rounded-lg border border-[#EAECF0] bg-[#FAFAFA] px-3 py-2 text-sm text-[#344054] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#B68A35]/40 disabled:opacity-50"
                  />
                  <span className={twMerge('mt-1 block text-[11px] text-[#98A2B3]', isArabicLanguage && 'text-right')}>{a('Comma-separated MOF email addresses', 'emailRecipientsSub')}</span>
                </label>

                <div className={twMerge('flex items-center justify-between gap-4', isArabicLanguage && 'flex-row-reverse')}>
                  <div className={isArabicLanguage ? 'text-right' : ''}>
                    <p className="text-sm font-medium text-[#344054]">{a('Daily digest', 'dailyDigest')}</p>
                    <p className="mt-0.5 text-xs text-[#98A2B3]">{a('Include a morning summary of token consumption', 'dailyDigestSub')}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!alertConfig.enabled}
                    onClick={() => setAlertConfig(prev => ({ ...prev, dailyDigest: !prev.dailyDigest }))}
                    className={twMerge(
                      'relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50',
                      !alertConfig.dailyDigest && 'bg-[#D0D5DD]',
                    )}
                    style={alertConfig.dailyDigest && alertConfig.enabled ? { backgroundColor: themeColors.primary } : undefined}
                    aria-label="Toggle daily digest"
                  >
                    <span className={twMerge(
                      'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                      alertConfig.dailyDigest ? 'translate-x-5' : 'translate-x-0',
                    )} />
                  </button>
                </div>

                <div className="rounded-lg border border-[#EAECF0] bg-[#FAFAFA] px-4 py-3 text-xs text-[#667085]">
                  Current org usage is <strong className="text-[#344054]">{orgUsagePercent}%</strong> of the monthly limit
                  ({formatTokens(orgTokensUsed)} / {formatTokens(ORG_TOKEN_LIMIT)}).
                  {orgUsagePercent >= alertConfig.warningPercent
                    ? ' Warning threshold already reached — alerts would fire in production.'
                    : ` Warning email would send at ${alertConfig.warningPercent}%.`}
                </div>

                <div className={twMerge('flex items-center gap-3', isArabicLanguage && 'flex-row-reverse')}>
                  <button
                    type="button"
                    onClick={saveAlertConfig}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: themeColors.primary }}
                  >
                    {a('Save alert settings', 'saveAlerts')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('overview')}
                    className="rounded-lg border border-[#EAECF0] px-4 py-2 text-sm font-medium text-[#344054] hover:bg-[#FAFAFA]"
                  >
                    {a('Back to overview', 'backToOverview')}
                  </button>
                  {alertSaved && (
                    <span className="text-xs font-medium" style={{ color: themeColors.primary }}>
                      {a('Settings saved', 'settingsSaved')}
                    </span>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ── ACCESS ── */}
          {activeTab === 'access' && (
            <div className="space-y-4">
              <div className={twMerge('flex flex-wrap items-end justify-between gap-4', isArabicLanguage && 'flex-row-reverse')}>
                <div className={isArabicLanguage ? 'text-right' : ''}>
                  <h2 className="text-lg font-semibold tracking-[-0.01em] text-[#101828]">{a('Access', 'accessTitle')}</h2>
                  <p className="mt-1 text-sm text-[#667085]">
                    {a('Grant or revoke AI services through Active Directory groups (recommended) or individual user overrides.', 'accessDesc')}
                  </p>
                </div>
                <div className="inline-flex rounded-lg border border-[#EAECF0] bg-white p-0.5">
                  {([
                    { id: 'ad-groups' as const, label: a('AD Groups', 'adGroups') },
                    { id: 'users' as const, label: a('Users', 'usersTitle') },
                  ]).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAccessScope(opt.id)}
                      className={twMerge(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                        accessScope === opt.id ? 'text-white' : 'text-[#667085] hover:text-[#344054]',
                      )}
                      style={accessScope === opt.id ? { backgroundColor: themeColors.primary } : undefined}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {accessScope === 'ad-groups' ? (
                <section className="bg-white rounded-xl border border-[#EAECF0] min-h-[calc(100vh-220px)] flex flex-col lg:flex-row overflow-hidden">
                  <div className="w-full lg:w-[360px] lg:flex-shrink-0 border-b lg:border-b-0 lg:border-r border-[#EAECF0] flex flex-col">
                    <div className="px-4 py-4 border-b border-[#EAECF0]">
                      <h3 className={twMerge('text-sm font-semibold text-[#101828]', isArabicLanguage && 'text-right')}>{a('Active Directory groups', 'adGroupsTitle')}</h3>
                      <p className={twMerge('mt-0.5 text-xs text-[#98A2B3]', isArabicLanguage && 'text-right')}>{ADMIN_AD_GROUPS.length} {isArabicLanguage ? 'مجموعات أمان' : 'security groups'}</p>
                      <input
                        type="text"
                        value={groupSearch}
                        onChange={e => setGroupSearch(e.target.value)}
                        placeholder={a('Search by group name or DN', 'searchGroupDn')}
                        className="mt-3 w-full px-3 py-2 text-sm border border-[#EAECF0] rounded-lg bg-[#FAFAFA] text-[#344054] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#B68A35]/40 focus:bg-white"
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {filteredGroups.length === 0 ? (
                        <p className="px-4 py-8 text-sm text-[#98A2B3] text-center">{a('No groups found', 'noGroupsFound')}</p>
                      ) : (
                        filteredGroups.map(group => {
                          const isSelected = group.id === selectedGroupId;
                          const enabledCount = getGroupEnabledServiceCount(group.id, groupAccess);
                          return (
                            <button
                              key={group.id}
                              onClick={() => setSelectedGroupId(group.id)}
                              className={twMerge(
                                'w-full flex items-start gap-3 px-4 py-3 border-b border-[#F2F4F7] transition-colors',
                                isArabicLanguage ? 'text-right flex-row-reverse' : 'text-left',
                                isSelected ? 'bg-[#FFF9F0]' : 'hover:bg-[#FAFAFA]',
                              )}
                            >
                              <div
                                className={twMerge(
                                  'w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5',
                                  isSelected ? 'text-white' : 'text-[#475467] bg-[#F2F4F7]',
                                )}
                                style={isSelected ? { backgroundColor: themeColors.primary } : undefined}
                              >
                                AD
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={twMerge(
                                  'text-sm truncate',
                                  isSelected ? 'font-semibold text-[#101828]' : 'font-medium text-[#344054]',
                                )}>
                                  {group.name}
                                </p>
                                <p className="text-xs text-[#98A2B3] truncate">{group.memberUserIds.length} {a('members', 'members')}</p>
                              </div>
                              <span className="text-[11px] font-medium text-[#667085] flex-shrink-0">
                                {enabledCount}/{ADMIN_SERVICES.length}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="px-6 py-5 border-b border-[#EAECF0]">
                      <div className={twMerge('flex items-start justify-between gap-4', isArabicLanguage && 'flex-row-reverse')}>
                        <div className={twMerge('min-w-0', isArabicLanguage && 'text-right')}>
                          <h3 className="text-base font-semibold text-[#101828]">{selectedGroup.name}</h3>
                          <p className="mt-0.5 text-sm text-[#667085]">{selectedGroup.description}</p>
                          <p className="mt-1 text-[11px] text-[#98A2B3] font-mono truncate">{selectedGroup.distinguishedName}</p>
                        </div>
                        <span className="text-xs font-medium text-[#667085] bg-[#F9FAFB] border border-[#EAECF0] rounded-full px-3 py-1 whitespace-nowrap">
                          {isArabicLanguage
                            ? `${getGroupEnabledServiceCount(selectedGroupId, groupAccess)} من ${ADMIN_SERVICES.length} مفعّل`
                            : `${getGroupEnabledServiceCount(selectedGroupId, groupAccess)} of ${ADMIN_SERVICES.length} enabled`}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {selectedGroup.memberUserIds.map(userId => {
                          const member = ADMIN_USERS.find(u => u.id === userId);
                          if (!member) return null;
                          return (
                            <span
                              key={userId}
                              className="inline-flex items-center rounded-full bg-[#F2F4F7] px-2.5 py-1 text-[11px] font-medium text-[#475467]"
                            >
                              {member.name}
                            </span>
                          );
                        })}
                      </div>
                      <p className={twMerge('mt-3 text-[11px] text-[#98A2B3]', isArabicLanguage && 'text-right')}>
                        {a('Granting or revoking a service updates access for every member of this AD group.', 'grantingNote')}
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-[#F2F4F7]">
                      {ADMIN_SERVICES.map(service => {
                        const enabled = groupAccess[selectedGroupId]?.[service.id] ?? false;
                        return (
                          <div
                            key={service.id}
                            className={twMerge('flex items-center justify-between gap-6 px-6 py-4 hover:bg-[#FAFAFA] transition-colors', isArabicLanguage && 'flex-row-reverse')}
                          >
                            <div className={twMerge('min-w-0', isArabicLanguage && 'text-right')}>
                              <p className="text-sm font-medium text-[#344054]">{service.name}</p>
                              <p className="mt-0.5 text-xs text-[#98A2B3]">
                                {enabled
                                  ? `${a('Access granted via', 'grantedVia')} ${selectedGroup.name}`
                                  : `${a('Access revoked via', 'revokedVia')} ${selectedGroup.name}`}
                              </p>
                            </div>
                            <button
                              onClick={() => toggleGroupServiceAccess(service.id)}
                              className={twMerge(
                                'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                                !enabled && 'bg-[#D0D5DD]',
                              )}
                              style={enabled ? { backgroundColor: themeColors.primary } : undefined}
                              aria-label={`${enabled ? 'Revoke' : 'Grant'} ${service.name} for AD group`}
                            >
                              <span className={twMerge(
                                'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                                enabled ? 'translate-x-5' : 'translate-x-0',
                              )} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              ) : (
                <section className="bg-white rounded-xl border border-[#EAECF0] min-h-[calc(100vh-220px)] flex flex-col lg:flex-row overflow-hidden">
                  {/* Users — left */}
                  <div className="w-full lg:w-[340px] lg:flex-shrink-0 border-b lg:border-b-0 lg:border-r border-[#EAECF0] flex flex-col">
                    <div className="px-4 py-4 border-b border-[#EAECF0]">
                      <h3 className={twMerge('text-sm font-semibold text-[#101828]', isArabicLanguage && 'text-right')}>{a('Users', 'usersTitle')}</h3>
                      <p className={twMerge('mt-0.5 text-xs text-[#98A2B3]', isArabicLanguage && 'text-right')}>{ADMIN_USERS.length} {a('employees', 'employees')}</p>
                      <input
                        type="text"
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        placeholder={a('Search by name or department', 'searchUserDept')}
                        className="mt-3 w-full px-3 py-2 text-sm border border-[#EAECF0] rounded-lg bg-[#FAFAFA] text-[#344054] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#B68A35]/40 focus:bg-white"
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {filteredUsers.length === 0 ? (
                        <p className="px-4 py-8 text-sm text-[#98A2B3] text-center">{a('No users found', 'noUsersFound')}</p>
                      ) : (
                        filteredUsers.map(user => {
                          const isSelected = user.id === selectedUserId;
                          const enabledCount = getEnabledServiceCount(user.id);
                          return (
                            <button
                              key={user.id}
                              onClick={() => setSelectedUserId(user.id)}
                              className={twMerge(
                                'w-full flex items-center gap-3 px-4 py-3 border-b border-[#F2F4F7] transition-colors',
                                isArabicLanguage ? 'text-right flex-row-reverse' : 'text-left',
                                isSelected ? 'bg-[#FFF9F0]' : 'hover:bg-[#FAFAFA]',
                              )}
                            >
                              <div
                                className={twMerge(
                                  'w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0',
                                  isSelected ? 'text-white' : 'text-[#475467] bg-[#F2F4F7]',
                                )}
                                style={isSelected ? { backgroundColor: themeColors.primary } : undefined}
                              >
                                {user.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={twMerge(
                                  'text-sm truncate',
                                  isSelected ? 'font-semibold text-[#101828]' : 'font-medium text-[#344054]',
                                )}>
                                  {user.name}
                                </p>
                                <p className="text-xs text-[#98A2B3] truncate">{user.department}</p>
                              </div>
                              <span className="text-[11px] font-medium text-[#667085] flex-shrink-0">
                                {enabledCount}/{ADMIN_SERVICES.length}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Services — right */}
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="px-6 py-5 border-b border-[#EAECF0]">
                      <div className={twMerge('flex items-start justify-between gap-4', isArabicLanguage && 'flex-row-reverse')}>
                        <div className={isArabicLanguage ? 'text-right' : ''}>
                          <h3 className="text-base font-semibold text-[#101828]">{selectedUser.name}</h3>
                          <p className="mt-0.5 text-sm text-[#667085]">{selectedUser.department}</p>
                        </div>
                        <span className="text-xs font-medium text-[#667085] bg-[#F9FAFB] border border-[#EAECF0] rounded-full px-3 py-1 whitespace-nowrap">
                          {isArabicLanguage
                            ? `${getEnabledServiceCount(selectedUserId)} من ${ADMIN_SERVICES.length} مفعّل`
                            : `${getEnabledServiceCount(selectedUserId)} of ${ADMIN_SERVICES.length} enabled`}
                        </span>
                      </div>
                      {selectedUserAdGroups.length > 0 && (
                        <div className="mt-3">
                          <p className={twMerge('text-[11px] font-medium text-[#667085] mb-1.5', isArabicLanguage && 'text-right')}>{a('Member of AD groups', 'memberOfAdGroups')}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedUserAdGroups.map(group => (
                              <button
                                key={group.id}
                                type="button"
                                onClick={() => {
                                  setSelectedGroupId(group.id);
                                  setAccessScope('ad-groups');
                                }}
                                className="inline-flex items-center rounded-full border border-[#EAECF0] bg-white px-2.5 py-1 text-[11px] font-medium text-[#475467] hover:bg-[#FAFAFA]"
                              >
                                {group.name}
                              </button>
                            ))}
                          </div>
                          <p className={twMerge('mt-2 text-[11px] text-[#98A2B3]', isArabicLanguage && 'text-right')}>
                            {a('Prefer revoking via AD Groups so membership stays aligned with Active Directory.', 'adGroupsNote')}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-[#F2F4F7]">
                      {ADMIN_SERVICES.map(service => {
                        const enabled = userAccess[selectedUserId]?.[service.id] ?? false;
                        const viaGroups = servicesViaAdGroups[service.id] ?? [];
                        return (
                          <div
                            key={service.id}
                            className={twMerge('flex items-center justify-between gap-6 px-6 py-4 hover:bg-[#FAFAFA] transition-colors', isArabicLanguage && 'flex-row-reverse')}
                          >
                            <div className={twMerge('min-w-0', isArabicLanguage && 'text-right')}>
                              <p className="text-sm font-medium text-[#344054]">{service.name}</p>
                              <p className="mt-0.5 text-xs text-[#98A2B3]">
                                {enabled
                                  ? (viaGroups.length > 0
                                    ? `${a('Access granted', 'accessGranted')} · ${isArabicLanguage ? 'عبر' : 'via'} ${viaGroups.join(', ')}`
                                    : `${a('Access granted', 'accessGranted')} · ${a('user override', 'userOverride')}`)
                                  : a('Access revoked', 'accessRevoked')}
                              </p>
                            </div>
                            <button
                              onClick={() => toggleServiceAccess(service.id)}
                              className={twMerge(
                                'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                                !enabled && 'bg-[#D0D5DD]',
                              )}
                              style={enabled ? { backgroundColor: themeColors.primary } : undefined}
                              aria-label={`${enabled ? 'Revoke' : 'Grant'} ${service.name}`}
                            >
                              <span className={twMerge(
                                'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                                enabled ? 'translate-x-5' : 'translate-x-0',
                              )} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ── MODELS ── */}
          {activeTab === 'models' && (
            <div className="space-y-6 max-w-2xl">
              <div className={isArabicLanguage ? 'text-right' : ''}>
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-[#101828]">{a('Models', 'modelsTitle')}</h2>
                <p className="mt-1 text-sm text-[#667085]">
                  {a('Select the active AI model for each capability type used across services.', 'modelsDesc')}
                </p>
              </div>

              <section className="bg-white rounded-xl border border-[#EAECF0] divide-y divide-[#EAECF0]">
                {(
                  [
                    { key: 'multimodal', label: a('Multimodal model', 'multimodalLabel'),  description: a('Used for vision, document analysis, and combined text + image tasks.', 'multimodalDesc') },
                    { key: 'voice',      label: a('Voice model', 'voiceLabel'),             description: a('Used for speech-to-text transcription in meeting summaries and voice input.', 'voiceDesc') },
                    { key: 'text',       label: a('Text model', 'textLabel'),               description: a('Used for general-purpose chat, Q&A, and lightweight text generation.', 'textDesc') },
                    { key: 'arabic',     label: a('Arabic model', 'arabicLabel'),           description: a('Used when Arabic language mode is active for culturally-aware responses.', 'arabicDesc') },
                  ] as { key: ModelKey; label: string; description: string }[]
                ).map(({ key, label, description }) => {
                  const isChanged = selectedModels[key] !== RECOMMENDED_MODELS[key];
                  return (
                  <div key={key} className="px-6 py-5 space-y-2.5">
                    <div className={twMerge('flex items-start justify-between gap-6', isArabicLanguage && 'flex-row-reverse')}>
                      <div className={twMerge('min-w-0', isArabicLanguage && 'text-right')}>
                        <p className="text-sm font-semibold text-[#101828]">{label}</p>
                        <p className="mt-0.5 text-xs text-[#98A2B3]">{description}</p>
                      </div>
                      <div className="relative flex-shrink-0 w-52">
                        <select
                          value={selectedModels[key]}
                          onChange={e => setSelectedModels(prev => ({ ...prev, [key]: e.target.value }))}
                          className={twMerge(
                            'w-full appearance-none rounded-lg border px-3 py-2 pr-8 text-sm text-[#344054] focus:outline-none focus:ring-2 focus:bg-white cursor-pointer',
                            isChanged
                              ? 'border-[#F79009] bg-[#FFFCF5] focus:ring-[#F79009]/40'
                              : 'border-[#EAECF0] bg-[#FAFAFA] focus:ring-[#B68A35]/40',
                          )}
                        >
                          {MODEL_OPTIONS[key].map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}{opt.recommended ? ` (${a('Recommended', 'recommended')})` : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3]" />
                      </div>
                    </div>
                    {isChanged && (
                      <div className={twMerge('flex items-start gap-2 rounded-lg border border-[#F79009]/40 bg-[#FFFCF5] px-3 py-2.5', isArabicLanguage && 'flex-row-reverse')}>
                        <svg className="w-4 h-4 text-[#F79009] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <p className={twMerge('text-xs text-[#B54708]', isArabicLanguage && 'text-right')}>
                          {a("You've selected a non-recommended model. This may affect response quality, accuracy, or service performance. Only change this if you're sure it meets your requirements.", 'nonRecommendedWarning')}
                        </p>
                      </div>
                    )}
                  </div>
                  );
                })}
              </section>

              <div className={twMerge('flex items-center gap-3', isArabicLanguage && 'flex-row-reverse')}>
                <button
                  type="button"
                  onClick={() => setModelsConfirmOpen(true)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: themeColors.primary }}
                >
                  {a('Save model settings', 'saveModels')}
                </button>
                {modelsSaved && (
                  <span className="text-xs font-medium" style={{ color: themeColors.primary }}>
                    {a('Settings saved', 'settingsSaved')}
                  </span>
                )}
              </div>

              {/* Confirm dialog */}
              {modelsConfirmOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir={isArabicLanguage ? 'rtl' : 'ltr'}>
                  <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setModelsConfirmOpen(false)} />
                  <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-[#EAECF0] p-6 space-y-4">
                    <div className={twMerge('flex items-start gap-3', isArabicLanguage && 'flex-row-reverse')}>
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                        <svg className="w-5 h-5 text-[#D97706]" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className={isArabicLanguage ? 'text-right' : ''}>
                        <h3 className="text-base font-semibold text-[#101828]">{a('Save model settings?', 'confirmTitle')}</h3>
                        <p className="mt-1.5 text-sm text-[#667085] leading-relaxed">
                          {a('Changing AI models may disrupt or affect the quality of active services. Users could experience different response behaviour until the new models are fully warmed up.', 'confirmDesc')}
                        </p>
                        <p className="mt-2 text-sm text-[#667085]">{a('Are you sure you want to proceed?', 'confirmQuestion')}</p>
                      </div>
                    </div>
                    <div className={twMerge('flex justify-end gap-3 pt-1', isArabicLanguage && 'flex-row-reverse')}>
                      <button
                        type="button"
                        onClick={() => setModelsConfirmOpen(false)}
                        className="rounded-lg border border-[#EAECF0] px-4 py-2 text-sm font-medium text-[#344054] hover:bg-[#FAFAFA] transition-colors"
                      >
                        {a('Cancel', 'cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={saveModels}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: themeColors.primary }}
                      >
                        {a('Yes, save settings', 'yesSave')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {activeTab === 'documents' && (
            <InquiryDocumentAdmin
              apiConfig={apiConfig}
              isArabic={Boolean(isArabicLanguage)}
              themeColor={themeColors.primary}
              variant="panel"
            />
          )}

          {/* ── EVALUATION FRAMEWORKS ── */}
          {activeTab === 'frameworks' && (
            <ProposalFrameworkAdmin
              apiConfig={apiConfig}
              isArabic={Boolean(isArabicLanguage)}
              themeColor={themeColors.primary}
            />
          )}

          {/* ── ACTIVITY ── */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div className={isArabicLanguage ? 'text-right' : ''}>
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-[#101828]">{a('Activity', 'activityTitle')}</h2>
                <p className="mt-1 text-sm text-[#667085]">
                  {a('BR-42 audit trail — source documents, exports, sharing, permissions, token limits, and administrative actions.', 'activityDesc')}
                </p>
              </div>

              <section className="bg-white rounded-xl border border-[#EAECF0] min-h-[calc(100vh-220px)] flex flex-col">
                <div className="border-b border-[#EAECF0] px-5 py-4 space-y-4">
                  <div className={twMerge('flex flex-wrap items-start justify-between gap-3', isArabicLanguage && 'flex-row-reverse')}>
                    <div className={isArabicLanguage ? 'text-right' : ''}>
                      <h2 className="text-sm font-semibold text-[#101828]">{a('Audit log', 'auditLog')}</h2>
                      <p className="mt-0.5 text-xs text-[#98A2B3]">
                        {isArabicLanguage
                          ? `يعرض ${filteredAuditLog.length} من أصل ${auditLog.length} حدث`
                          : `Showing ${filteredAuditLog.length} of ${auditLog.length} events · retention up to 12 months`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {AUDIT_DATE_RANGE_OPTIONS.map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setAuditDateRange(opt.id)}
                          className={twMerge(
                            'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                            auditDateRange === opt.id
                              ? 'text-white border-transparent'
                              : 'text-[#667085] border-[#EAECF0] bg-white hover:bg-[#FAFAFA]',
                          )}
                          style={auditDateRange === opt.id ? { backgroundColor: themeColors.primary } : undefined}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                    <input
                      type="search"
                      value={auditSearch}
                      onChange={e => setAuditSearch(e.target.value)}
                      placeholder={a('Search audit log…', 'searchAudit')}
                      className="lg:col-span-2 w-full px-3 py-2 text-sm border border-[#EAECF0] rounded-lg bg-[#FAFAFA] text-[#344054] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#B68A35]/40 focus:bg-white"
                    />
                    <select
                      value={auditUser}
                      onChange={e => setAuditUser(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[#EAECF0] rounded-lg bg-[#FAFAFA] text-[#344054] focus:outline-none focus:ring-2 focus:ring-[#B68A35]/40"
                    >
                      <option value="all">{a('All users', 'allUsers')}</option>
                      {auditUserOptions.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <select
                      value={auditDepartment}
                      onChange={e => setAuditDepartment(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[#EAECF0] rounded-lg bg-[#FAFAFA] text-[#344054] focus:outline-none focus:ring-2 focus:ring-[#B68A35]/40"
                    >
                      <option value="all">{a('All departments', 'allDepts')}</option>
                      {auditDepartmentOptions.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <select
                      value={auditService}
                      onChange={e => setAuditService(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[#EAECF0] rounded-lg bg-[#FAFAFA] text-[#344054] focus:outline-none focus:ring-2 focus:ring-[#B68A35]/40"
                    >
                      <option value="all">{a('All services', 'allServices')}</option>
                      {auditServiceOptions.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <select
                      value={auditEventType}
                      onChange={e => setAuditEventType(e.target.value as AuditEventType | 'all')}
                      className="w-full px-3 py-2 text-sm border border-[#EAECF0] rounded-lg bg-[#FAFAFA] text-[#344054] focus:outline-none focus:ring-2 focus:ring-[#B68A35]/40"
                    >
                      <option value="all">{a('All event types', 'allEventTypes')}</option>
                      {(Object.keys(AUDIT_EVENT_TYPE_LABELS) as AuditEventType[]).map(type => (
                        <option key={type} value={type}>{AUDIT_EVENT_TYPE_LABELS[type]}</option>
                      ))}
                    </select>
                  </div>

                  <div className={twMerge('flex items-center justify-between gap-3', isArabicLanguage && 'flex-row-reverse')}>
                    <p className="text-[11px] text-[#98A2B3]">
                      {isArabicLanguage ? 'تصفية حسب فئات: المستندات، التصدير، المشاركة، الصلاحيات، حدود الرموز، الإجراءات الإدارية.' : 'Filter by BR-42 categories: documents, exports, sharing, permissions, token limits, admin actions.'}
                    </p>
                    <button
                      type="button"
                      onClick={clearAuditFilters}
                      className="text-xs font-medium text-[#667085] hover:text-[#344054] whitespace-nowrap"
                    >
                      {a('Reset filters', 'resetFilters')}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-sm min-w-[960px]">
                    <thead>
                      <tr className="border-b border-[#EAECF0] bg-[#FAFAFA]">
                        <th className={twMerge('py-3 px-5 text-xs font-medium text-[#667085]', isArabicLanguage ? 'text-right' : 'text-left')}>{a('Timestamp', 'colTimestamp')}</th>
                        <th className={twMerge('py-3 px-4 text-xs font-medium text-[#667085]', isArabicLanguage ? 'text-right' : 'text-left')}>{a('User', 'colUser')}</th>
                        <th className={twMerge('py-3 px-4 text-xs font-medium text-[#667085]', isArabicLanguage ? 'text-right' : 'text-left')}>{a('Department', 'colDept')}</th>
                        <th className={twMerge('py-3 px-4 text-xs font-medium text-[#667085]', isArabicLanguage ? 'text-right' : 'text-left')}>{a('Service', 'colService')}</th>
                        <th className={twMerge('py-3 px-4 text-xs font-medium text-[#667085]', isArabicLanguage ? 'text-right' : 'text-left')}>{a('Event type', 'colEventType')}</th>
                        <th className={twMerge('py-3 px-4 text-xs font-medium text-[#667085]', isArabicLanguage ? 'text-left' : 'text-right')}>{a('Tokens', 'colTokens')}</th>
                        <th className={twMerge('py-3 px-5 text-xs font-medium text-[#667085]', isArabicLanguage ? 'text-right' : 'text-left')}>{a('Event', 'colEvent')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAuditLog.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-sm text-[#98A2B3]">
                            {a('No audit events match the current filters.', 'noAuditEvents')}
                          </td>
                        </tr>
                      ) : (
                        filteredAuditLog.map(entry => (
                          <tr key={entry.id} className="border-b border-[#F2F4F7] last:border-0 hover:bg-[#FAFAFA]">
                            <td className="py-3 px-5 text-[#667085] whitespace-nowrap text-xs">{entry.timestamp}</td>
                            <td className="py-3 px-4 text-[#344054] text-xs font-medium">{entry.userName}</td>
                            <td className="py-3 px-4 text-[#667085] text-xs">{entry.department}</td>
                            <td className="py-3 px-4 text-[#344054] text-xs">{entry.service}</td>
                            <td className="py-3 px-4 text-xs">
                              <span className="inline-flex max-w-[160px] truncate rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[11px] font-medium text-[#475467]">
                                {AUDIT_EVENT_TYPE_LABELS[entry.eventType]}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-[#344054] text-xs font-medium">
                              {entry.tokens > 0 ? formatTokens(entry.tokens) : '—'}
                            </td>
                            <td className="py-3 px-5 text-[#667085] text-xs">{entry.event}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
