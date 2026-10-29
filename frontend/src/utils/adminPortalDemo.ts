export interface AdminUser {
  id: string;
  name: string;
  department: string;
  tokensUsed: number;
  tokenLimit: number;
  sessions?: number;
  lastActive?: string;
}

export interface ServiceUsageStat {
  serviceId: string;
  name: string;
  invocations: number;
  tokens: number;
  activeUsers: number;
}

export interface AdminDepartment {
  id: string;
  name: string;
  tokensUsed: number;
  tokenLimit: number;
  userCount: number;
}

export interface AdminService {
  id: string;
  name: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  department: string;
  service: string;
  tokens: number;
  event: string;
  /** BR-42 event category */
  eventType: AuditEventType;
}

/** BR-42 audit event categories */
export type AuditEventType =
  | 'source_document'
  | 'data_export'
  | 'sharing'
  | 'permission_change'
  | 'token_limit'
  | 'admin_action'
  | 'service_invoke'
  | 'access_denied';

export const AUDIT_EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  source_document: 'Source documents accessed',
  data_export: 'Data exports performed',
  sharing: 'Sharing activities',
  permission_change: 'Changes to permissions',
  token_limit: 'Changes to token limits',
  admin_action: 'Administrative actions',
  service_invoke: 'AI service invoked',
  access_denied: 'Access denied',
};

export type AuditDateRange = '30d' | '6m' | '12m';

export const AUDIT_DATE_RANGE_OPTIONS: { id: AuditDateRange; label: string }[] = [
  { id: '30d', label: 'Last 30 Days' },
  { id: '6m', label: 'Last 6 Months' },
  { id: '12m', label: 'Last 12 Months' },
];

/** Demo "today" for consistent date-range filtering in the prototype */
export const AUDIT_REFERENCE_DATE = new Date('2026-07-31T12:00:00');

export function parseAuditTimestamp(timestamp: string): Date {
  const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

export function getAuditDateRangeStart(range: AuditDateRange, reference = AUDIT_REFERENCE_DATE): Date {
  const start = new Date(reference);
  if (range === '30d') {
    start.setDate(start.getDate() - 30);
  } else if (range === '6m') {
    start.setMonth(start.getMonth() - 6);
  } else {
    start.setFullYear(start.getFullYear() - 1);
  }
  start.setHours(0, 0, 0, 0);
  return start;
}

export function filterAuditLog(
  entries: AuditLogEntry[],
  filters: {
    search?: string;
    user?: string;
    department?: string;
    service?: string;
    eventType?: AuditEventType | 'all';
    dateRange?: AuditDateRange;
  },
): AuditLogEntry[] {
  const search = filters.search?.trim().toLowerCase() ?? '';
  const rangeStart = getAuditDateRangeStart(filters.dateRange ?? '12m');

  return entries.filter(entry => {
    const ts = parseAuditTimestamp(entry.timestamp);
    if (ts < rangeStart) return false;

    if (filters.user && filters.user !== 'all' && entry.userName !== filters.user) return false;
    if (filters.department && filters.department !== 'all' && entry.department !== filters.department) return false;
    if (filters.service && filters.service !== 'all' && entry.service !== filters.service) return false;
    if (filters.eventType && filters.eventType !== 'all' && entry.eventType !== filters.eventType) return false;

    if (search) {
      const haystack = [
        entry.userName,
        entry.department,
        entry.service,
        entry.event,
        AUDIT_EVENT_TYPE_LABELS[entry.eventType],
      ].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}


export const ORG_TOKEN_LIMIT = 5_000_000;

export const ADMIN_SERVICES: AdminService[] = [
  { id: 'document-qa', name: 'Document Q&A' },
  { id: 'email-drafting', name: 'Email Drafting' },
  { id: 'meeting-summary', name: 'Meeting Transcript Summarization' },
  { id: 'presentation', name: 'Presentation Generation' },
  { id: 'proposal-eval', name: 'RFP & Proposal Evaluation' },
  { id: 'translation', name: 'Bi-directional Translation' },
  { id: 'inquiry-bot', name: 'Inquiry Bot' },
  { id: 'dept-search', name: 'Departmental Search' },
];

export const ADMIN_USERS: AdminUser[] = [
  { id: 'u1', name: 'Ahmed Al Mansouri', department: 'Finance Operations', tokensUsed: 482_000, tokenLimit: 600_000, sessions: 47, lastActive: 'Today' },
  { id: 'u2', name: 'Sara Al Khouri', department: 'Digital Transformation', tokensUsed: 391_000, tokenLimit: 500_000, sessions: 38, lastActive: 'Today' },
  { id: 'u3', name: 'Mohammed Ali', department: 'IT Services', tokensUsed: 278_000, tokenLimit: 450_000, sessions: 29, lastActive: 'Yesterday' },
  { id: 'u4', name: 'Fatima Al Nuaimi', department: 'Human Resources', tokensUsed: 156_000, tokenLimit: 400_000, sessions: 22, lastActive: 'Today' },
  { id: 'u5', name: 'Omar Hassan', department: 'Procurement', tokensUsed: 89_000, tokenLimit: 350_000, sessions: 14, lastActive: '2 days ago' },
];

export const SERVICE_USAGE_STATS: ServiceUsageStat[] = [
  { serviceId: 'document-qa', name: 'Document Q&A', invocations: 1240, tokens: 420_000, activeUsers: 68 },
  { serviceId: 'dept-search', name: 'Departmental Search', invocations: 890, tokens: 310_000, activeUsers: 52 },
  { serviceId: 'email-drafting', name: 'Email Drafting', invocations: 756, tokens: 245_000, activeUsers: 61 },
  { serviceId: 'translation', name: 'Bi-directional Translation', invocations: 612, tokens: 198_000, activeUsers: 44 },
  { serviceId: 'proposal-eval', name: 'RFP & Proposal Evaluation', invocations: 594, tokens: 180_000, activeUsers: 72 },
  { serviceId: 'inquiry-bot', name: 'Inquiry Bot', invocations: 534, tokens: 142_000, activeUsers: 38 },
  { serviceId: 'meeting-summary', name: 'Meeting Transcript Summarization', invocations: 421, tokens: 128_000, activeUsers: 31 },
  { serviceId: 'presentation', name: 'Presentation Generation', invocations: 198, tokens: 72_000, activeUsers: 17 },
];

export const ADMIN_DEPARTMENTS: AdminDepartment[] = [
  { id: 'd1', name: 'Finance Operations', tokensUsed: 920_000, tokenLimit: 1_200_000, userCount: 48 },
  { id: 'd2', name: 'Digital Transformation', tokensUsed: 740_000, tokenLimit: 1_000_000, userCount: 32 },
  { id: 'd3', name: 'Human Resources', tokensUsed: 410_000, tokenLimit: 800_000, userCount: 24 },
  { id: 'd4', name: 'Procurement', tokensUsed: 285_000, tokenLimit: 600_000, userCount: 18 },
  { id: 'd5', name: 'Corporate Services', tokensUsed: 198_000, tokenLimit: 500_000, userCount: 15 },
];

/** All MOF employees can access RFP & Proposal Evaluation */
export const INITIAL_USER_ACCESS: Record<string, Record<string, boolean>> = {
  u1: {
    'document-qa': true,
    'email-drafting': true,
    'meeting-summary': true,
    'presentation': true,
    'proposal-eval': true,
    'translation': true,
    'inquiry-bot': false,
    'dept-search': true,
  },
  u2: {
    'document-qa': true,
    'email-drafting': true,
    'meeting-summary': true,
    'presentation': true,
    'proposal-eval': true,
    'translation': true,
    'inquiry-bot': true,
    'dept-search': true,
  },
  u3: {
    'document-qa': true,
    'email-drafting': true,
    'meeting-summary': false,
    'presentation': false,
    'proposal-eval': true,
    'translation': true,
    'inquiry-bot': false,
    'dept-search': false,
  },
  u4: {
    'document-qa': true,
    'email-drafting': true,
    'meeting-summary': true,
    'presentation': false,
    'proposal-eval': true,
    'translation': true,
    'inquiry-bot': true,
    'dept-search': false,
  },
  u5: {
    'document-qa': true,
    'email-drafting': false,
    'meeting-summary': false,
    'presentation': false,
    'proposal-eval': true,
    'translation': false,
    'inquiry-bot': false,
    'dept-search': false,
  },
};

/** Active Directory security groups used to grant/revoke AI service access */
export interface AdminAdGroup {
  id: string;
  name: string;
  distinguishedName: string;
  description: string;
  memberUserIds: string[];
}

export const ADMIN_AD_GROUPS: AdminAdGroup[] = [
  {
    id: 'adg-finance',
    name: 'MOF-AI-Finance-Users',
    distinguishedName: 'CN=MOF-AI-Finance-Users,OU=AI,OU=Groups,DC=mof,DC=gov,DC=ae',
    description: 'Finance Operations staff with core AI services',
    memberUserIds: ['u1'],
  },
  {
    id: 'adg-digital',
    name: 'MOF-AI-Digital-Transformation',
    distinguishedName: 'CN=MOF-AI-Digital-Transformation,OU=AI,OU=Groups,DC=mof,DC=gov,DC=ae',
    description: 'Digital Transformation analysts and product owners',
    memberUserIds: ['u2'],
  },
  {
    id: 'adg-hr',
    name: 'MOF-AI-HR-Policy',
    distinguishedName: 'CN=MOF-AI-HR-Policy,OU=AI,OU=Groups,DC=mof,DC=gov,DC=ae',
    description: 'HR policy and employee-services roles',
    memberUserIds: ['u4'],
  },
  {
    id: 'adg-procurement',
    name: 'MOF-AI-Procurement',
    distinguishedName: 'CN=MOF-AI-Procurement,OU=AI,OU=Groups,DC=mof,DC=gov,DC=ae',
    description: 'Procurement officers for RFP and proposal workflows',
    memberUserIds: ['u5'],
  },
  {
    id: 'adg-all-employees',
    name: 'MOF-AI-All-Employees',
    distinguishedName: 'CN=MOF-AI-All-Employees,OU=AI,OU=Groups,DC=mof,DC=gov,DC=ae',
    description: 'Baseline AI access for all MOF employees',
    memberUserIds: ['u1', 'u2', 'u3', 'u4', 'u5'],
  },
];

/** Initial service entitlements per AD group (grant/revoke applies to all members) */
export const INITIAL_AD_GROUP_ACCESS: Record<string, Record<string, boolean>> = {
  'adg-finance': {
    'document-qa': true,
    'email-drafting': true,
    'meeting-summary': true,
    'presentation': true,
    'proposal-eval': true,
    'translation': true,
    'inquiry-bot': false,
    'dept-search': true,
  },
  'adg-digital': {
    'document-qa': true,
    'email-drafting': true,
    'meeting-summary': true,
    'presentation': true,
    'proposal-eval': true,
    'translation': true,
    'inquiry-bot': true,
    'dept-search': true,
  },
  'adg-hr': {
    'document-qa': true,
    'email-drafting': true,
    'meeting-summary': true,
    'presentation': false,
    'proposal-eval': true,
    'translation': true,
    'inquiry-bot': true,
    'dept-search': false,
  },
  'adg-procurement': {
    'document-qa': true,
    'email-drafting': true,
    'meeting-summary': true,
    'presentation': true,
    'proposal-eval': true,
    'translation': false,
    'inquiry-bot': false,
    'dept-search': false,
  },
  'adg-all-employees': {
    'document-qa': true,
    'email-drafting': false,
    'meeting-summary': false,
    'presentation': false,
    'proposal-eval': true,
    'translation': false,
    'inquiry-bot': false,
    'dept-search': false,
  },
};

export function getAdGroupsForUser(userId: string): AdminAdGroup[] {
  return ADMIN_AD_GROUPS.filter(group => group.memberUserIds.includes(userId));
}

export function getGroupEnabledServiceCount(
  groupId: string,
  groupAccess: Record<string, Record<string, boolean>>,
): number {
  return ADMIN_SERVICES.filter(s => groupAccess[groupId]?.[s.id]).length;
}

export function getServicesGrantedByAdGroups(
  userId: string,
  groupAccess: Record<string, Record<string, boolean>>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  getAdGroupsForUser(userId).forEach(group => {
    ADMIN_SERVICES.forEach(service => {
      if (groupAccess[group.id]?.[service.id]) {
        if (!result[service.id]) result[service.id] = [];
        result[service.id].push(group.name);
      }
    });
  });
  return result;
}


export const INITIAL_DEPARTMENT_ACCESS: Record<string, Record<string, boolean>> = {
  d1: {
    'document-qa': true,
    'email-drafting': true,
    'meeting-summary': true,
    'presentation': true,
    'proposal-eval': true,
    'translation': true,
    'inquiry-bot': false,
    'dept-search': true,
  },
  d2: {
    'document-qa': true,
    'email-drafting': true,
    'meeting-summary': true,
    'presentation': true,
    'proposal-eval': true,
    'translation': true,
    'inquiry-bot': true,
    'dept-search': true,
  },
  d3: {
    'document-qa': true,
    'email-drafting': true,
    'meeting-summary': true,
    'presentation': false,
    'proposal-eval': true,
    'translation': true,
    'inquiry-bot': true,
    'dept-search': false,
  },
  d4: {
    'document-qa': true,
    'email-drafting': true,
    'meeting-summary': false,
    'presentation': false,
    'proposal-eval': true,
    'translation': false,
    'inquiry-bot': false,
    'dept-search': false,
  },
  d5: {
    'document-qa': true,
    'email-drafting': true,
    'meeting-summary': false,
    'presentation': false,
    'proposal-eval': true,
    'translation': true,
    'inquiry-bot': false,
    'dept-search': false,
  },
};

export const AUDIT_LOG: AuditLogEntry[] = [
  {
    id: '1',
    timestamp: '2026-07-21 09:14',
    userId: 'u1',
    userName: 'Ahmed Al Mansouri',
    department: 'Finance Operations',
    service: 'Departmental Search',
    tokens: 12_400,
    event: 'AI service invoked',
    eventType: 'service_invoke',
  },
  {
    id: '2',
    timestamp: '2026-07-21 08:52',
    userId: 'u3',
    userName: 'Mohammed Ali',
    department: 'IT Services',
    service: 'Presentation Generation',
    tokens: 0,
    event: 'Access denied',
    eventType: 'access_denied',
  },
  {
    id: '3',
    timestamp: '2026-07-20 16:30',
    userId: 'admin',
    userName: 'System Admin',
    department: '—',
    service: 'Inquiry Bot',
    tokens: 0,
    event: 'Access granted — Fatima Al Nuaimi',
    eventType: 'permission_change',
  },
  {
    id: '4',
    timestamp: '2026-07-20 14:08',
    userId: 'u2',
    userName: 'Sara Al Khouri',
    department: 'Digital Transformation',
    service: 'Document Q&A',
    tokens: 8_200,
    event: 'Data export performed — Q3_Budget_Summary.xlsx',
    eventType: 'data_export',
  },
  {
    id: '5',
    timestamp: '2026-07-20 11:45',
    userId: 'u4',
    userName: 'Fatima Al Nuaimi',
    department: 'Human Resources',
    service: 'Inquiry Bot',
    tokens: 3_100,
    event: 'Source document accessed — Remote_Work_Policy_v3.pdf',
    eventType: 'source_document',
  },
  {
    id: '6',
    timestamp: '2026-07-19 17:22',
    userId: 'admin',
    userName: 'System Admin',
    department: 'Digital Transformation',
    service: '—',
    tokens: 0,
    event: 'Token limit updated — Digital Transformation (1.0M → 1.1M)',
    eventType: 'token_limit',
  },
  {
    id: '7',
    timestamp: '2026-07-19 10:05',
    userId: 'u5',
    userName: 'Omar Hassan',
    department: 'Procurement',
    service: 'RFP & Proposal Evaluation',
    tokens: 18_600,
    event: 'AI service invoked',
    eventType: 'service_invoke',
  },
  {
    id: '8',
    timestamp: '2026-07-18 15:40',
    userId: 'admin',
    userName: 'System Admin',
    department: 'IT Services',
    service: 'Bi-directional Translation',
    tokens: 0,
    event: 'Access revoked — Mohammed Ali',
    eventType: 'permission_change',
  },
  {
    id: '9',
    timestamp: '2026-07-17 13:22',
    userId: 'u2',
    userName: 'Sara Al Khouri',
    department: 'Digital Transformation',
    service: 'RFP & Proposal Evaluation',
    tokens: 0,
    event: 'Workspace shared with Ahmed Al Mansouri',
    eventType: 'sharing',
  },
  {
    id: '10',
    timestamp: '2026-07-15 09:40',
    userId: 'u1',
    userName: 'Ahmed Al Mansouri',
    department: 'Finance Operations',
    service: 'Document Q&A',
    tokens: 4_100,
    event: 'Source document accessed — Finance_Dataset_Q3_2026.xlsx',
    eventType: 'source_document',
  },
  {
    id: '11',
    timestamp: '2026-07-12 16:05',
    userId: 'u5',
    userName: 'Omar Hassan',
    department: 'Procurement',
    service: 'RFP & Proposal Evaluation',
    tokens: 2_400,
    event: 'Data export performed — MOF_Proposal_Evaluation_Report.txt',
    eventType: 'data_export',
  },
  {
    id: '12',
    timestamp: '2026-07-10 11:18',
    userId: 'admin',
    userName: 'System Admin',
    department: '—',
    service: 'Token alerts',
    tokens: 0,
    event: 'Administrative action — alert thresholds updated (80% / 95%)',
    eventType: 'admin_action',
  },
  {
    id: '13',
    timestamp: '2026-07-08 14:50',
    userId: 'u4',
    userName: 'Fatima Al Nuaimi',
    department: 'Human Resources',
    service: 'Meeting Transcript Summarization',
    tokens: 0,
    event: 'Chat shared with Sara Al Khouri',
    eventType: 'sharing',
  },
  {
    id: '14',
    timestamp: '2026-06-28 10:12',
    userId: 'u3',
    userName: 'Mohammed Ali',
    department: 'IT Services',
    service: 'Document Q&A',
    tokens: 6_800,
    event: 'Source document accessed — IT_Security_Standards.docx',
    eventType: 'source_document',
  },
  {
    id: '15',
    timestamp: '2026-06-15 09:30',
    userId: 'admin',
    userName: 'System Admin',
    department: 'Finance Operations',
    service: '—',
    tokens: 0,
    event: 'Token limit updated — Finance Operations (1.2M → 1.25M)',
    eventType: 'token_limit',
  },
  {
    id: '16',
    timestamp: '2026-05-22 15:44',
    userId: 'u1',
    userName: 'Ahmed Al Mansouri',
    department: 'Finance Operations',
    service: 'Departmental Search',
    tokens: 5_600,
    event: 'Data export performed — Dept_Search_Results.csv',
    eventType: 'data_export',
  },
  {
    id: '17',
    timestamp: '2026-04-18 12:05',
    userId: 'admin',
    userName: 'System Admin',
    department: '—',
    service: 'Presentation Generation',
    tokens: 0,
    event: 'Access granted — Omar Hassan',
    eventType: 'permission_change',
  },
  {
    id: '18',
    timestamp: '2026-03-09 08:55',
    userId: 'u2',
    userName: 'Sara Al Khouri',
    department: 'Digital Transformation',
    service: 'Bi-directional Translation',
    tokens: 0,
    event: 'Private copy shared with Fatima Al Nuaimi',
    eventType: 'sharing',
  },
  {
    id: '19',
    timestamp: '2026-02-14 16:20',
    userId: 'admin',
    userName: 'System Admin',
    department: '—',
    service: '—',
    tokens: 0,
    event: 'Administrative action — org monthly token ceiling reviewed',
    eventType: 'admin_action',
  },
  {
    id: '20',
    timestamp: '2026-01-20 11:10',
    userId: 'u5',
    userName: 'Omar Hassan',
    department: 'Procurement',
    service: 'Email Drafting',
    tokens: 1_200,
    event: 'Access denied',
    eventType: 'access_denied',
  },
  {
    id: '21',
    timestamp: '2025-11-12 09:45',
    userId: 'u4',
    userName: 'Fatima Al Nuaimi',
    department: 'Human Resources',
    service: 'Inquiry Bot',
    tokens: 2_900,
    event: 'Source document accessed — Leave_Policy_2025.pdf',
    eventType: 'source_document',
  },
  {
    id: '22',
    timestamp: '2025-09-03 14:30',
    userId: 'admin',
    userName: 'System Admin',
    department: 'Procurement',
    service: '—',
    tokens: 0,
    event: 'Token limit updated — Procurement (500K → 600K)',
    eventType: 'token_limit',
  },
  {
    id: '23',
    timestamp: '2025-08-15 10:00',
    userId: 'admin',
    userName: 'System Admin',
    department: '—',
    service: '—',
    tokens: 0,
    event: 'Administrative action — audit retention policy set to 12 months',
    eventType: 'admin_action',
  },
];

export function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return value.toString();
}

export function getTokenStatus(used: number, limit: number): 'ok' | 'warning' | 'exceeded' {
  const ratio = used / limit;
  if (ratio >= 1) return 'exceeded';
  if (ratio >= 0.8) return 'warning';
  return 'ok';
}

export function getOrgTokensUsed(): number {
  return ADMIN_DEPARTMENTS.reduce((sum, dept) => sum + dept.tokensUsed, 0);
}

export function getTotalOrgUsers(): number {
  return ADMIN_DEPARTMENTS.reduce((sum, dept) => sum + dept.userCount, 0);
}

export function getActiveUsersCount(): number {
  return 84;
}

export function getUserLeaderboard() {
  return [...ADMIN_USERS].sort((a, b) => b.tokensUsed - a.tokensUsed);
}

export function getDepartmentLeaderboard() {
  return [...ADMIN_DEPARTMENTS].sort((a, b) => b.tokensUsed - a.tokensUsed);
}

export function getServiceLeaderboard() {
  return [...SERVICE_USAGE_STATS].sort((a, b) => b.tokens - a.tokens);
}

/** Governance KPIs for the admin overview (current month) */
export const GOVERNANCE_KPIS = {
  accessDenied: 23,
  permissionChanges: 14,
  dataExports: 9,
  sharingActivities: 31,
} as const;

export interface TokenAlertConfig {
  enabled: boolean;
  warningPercent: number;
  criticalPercent: number;
  recipients: string;
  dailyDigest: boolean;
}

export const DEFAULT_TOKEN_ALERT_CONFIG: TokenAlertConfig = {
  enabled: true,
  warningPercent: 80,
  criticalPercent: 95,
  recipients: 'ai-admins@mof.gov.ae, compass-ops@mof.gov.ae',
  dailyDigest: true,
};

export type AdminExportFormat = 'csv' | 'excel' | 'pdf';

export function buildAdminOverviewExport(
  format: AdminExportFormat,
  opts: {
    orgTokensUsed: number;
    orgLimit: number;
    totalUsers: number;
    activeUsers: number;
    serviceCount: number;
    governance: typeof GOVERNANCE_KPIS;
    alertConfig: TokenAlertConfig;
  },
): { filename: string; mimeType: string; content: string } {
  const date = '2026-07-31';
  const lines = [
    ['Metric', 'Value'],
    ['Report date', date],
    ['Services available', String(opts.serviceCount)],
    ['Total users', String(opts.totalUsers)],
    ['Active users (30d)', String(opts.activeUsers)],
    ['Token usage', formatTokens(opts.orgTokensUsed)],
    ['Token limit', formatTokens(opts.orgLimit)],
    ['Access denied', String(opts.governance.accessDenied)],
    ['Permission changes', String(opts.governance.permissionChanges)],
    ['Data exports', String(opts.governance.dataExports)],
    ['Sharing activities', String(opts.governance.sharingActivities)],
    ['Alert enabled', opts.alertConfig.enabled ? 'Yes' : 'No'],
    ['Warning threshold %', String(opts.alertConfig.warningPercent)],
    ['Critical threshold %', String(opts.alertConfig.criticalPercent)],
    ['Alert recipients', opts.alertConfig.recipients],
  ];

  if (format === 'pdf') {
    const body = [
      'UNITED ARAB EMIRATES — MINISTRY OF FINANCE',
      'AI Admin Panel — Usage & Governance Report',
      `Generated: ${date}`,
      '',
      ...lines.slice(1).map(([k, v]) => `${k}: ${v}`),
      '',
      '— End of report —',
    ].join('\n');
    return {
      filename: `MOF_AI_Admin_Report_${date}.txt`,
      mimeType: 'text/plain;charset=utf-8',
      content: body,
    };
  }

  const sep = format === 'excel' ? '\t' : ',';
  const escape = (cell: string) => {
    if (format === 'excel') return cell;
    if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
    return cell;
  };
  const content = lines.map(row => row.map(escape).join(sep)).join('\n');

  if (format === 'excel') {
    return {
      filename: `MOF_AI_Admin_Report_${date}.xls`,
      mimeType: 'application/vnd.ms-excel;charset=utf-8',
      content,
    };
  }

  return {
    filename: `MOF_AI_Admin_Report_${date}.csv`,
    mimeType: 'text/csv;charset=utf-8',
    content,
  };
}
