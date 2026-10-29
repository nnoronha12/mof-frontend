import type { Service, StartupData } from '../models/startup';
import { apiRouteUrl, FALLBACK_SERVICE_ROUTES, GENERAL_CHAT_WEBHOOK_URL } from '../constants/chatConstants';

/**
 * Services are identified by the `slug` from the service catalogue (`GET user/services`),
 * never by their display name. These are the slugs the portal has its own screens for;
 * every other service is a plain chat on the route the catalogue gives it.
 */
export const SERVICE_SLUG = {
  inquiryBot: 'inquiry-bot',
  presentation: 'presentation-generation',
  proposal: 'proposal-evaluation',
  documentQa: 'document-qa',
  translation: 'translation',
} as const;

type SluggedService = { slug?: string } | null | undefined;

const hasSlug = (service: SluggedService, slug: string): boolean => service?.slug === slug;

export const isInquiryBotService = (service: SluggedService) => hasSlug(service, SERVICE_SLUG.inquiryBot);
export const isPresentationService = (service: SluggedService) => hasSlug(service, SERVICE_SLUG.presentation);
export const isProposalEvaluationService = (service: SluggedService) => hasSlug(service, SERVICE_SLUG.proposal);
export const isDocumentQaService = (service: SluggedService) => hasSlug(service, SERVICE_SLUG.documentQa);

/**
 * Fallback for when the catalogue cannot be loaded and only the static `user/initialize`
 * list is available. Those entries have no slug, status or usable route, so they are
 * recognised by name here, and only here. Order matters: the RFP service's Arabic
 * name also contains "العروض".
 */
const LEGACY_NAME_RULES: Array<{ slug: string; status: Service['status']; names: string[] }> = [
  { slug: SERVICE_SLUG.proposal, status: 'live', names: ['rfp', 'proposal summar', 'proposal evaluation', 'procurement'] },
  { slug: SERVICE_SLUG.inquiryBot, status: 'live', names: ['inquiry', 'مساعد الاستفسارات', 'روبوت الاستفسارات'] },
  { slug: SERVICE_SLUG.documentQa, status: 'live', names: ['document q&a', 'document qa', 'الأسئلة والأجوبة حول المستندات'] },
  { slug: SERVICE_SLUG.translation, status: 'live', names: ['translat', 'ترجم'] },
  { slug: SERVICE_SLUG.presentation, status: 'live', names: ['presentation', 'العروض'] },
  { slug: 'email-drafting', status: 'retired', names: ['email drafting'] },
  { slug: 'meeting-summarization', status: 'phase_two', names: ['meeting'] },
  { slug: 'departmental-search', status: 'phase_two', names: ['department', 'search'] },
];

const applyLegacyIdentity = (service: Service, baseUrl?: string) => {
  const name = `${service.nameEn ?? ''} ${service.nameAr ?? ''}`.toLowerCase();
  const rule = LEGACY_NAME_RULES.find((item) => item.names.some((part) => name.includes(part)));
  service.slug = rule?.slug;
  service.status = rule?.status ?? 'phase_two';
  const route = rule ? FALLBACK_SERVICE_ROUTES[rule.slug] : undefined;
  service.webHookUrl = route ? apiRouteUrl(route, baseUrl) : GENERAL_CHAT_WEBHOOK_URL;
};

/** Gives the static `user/initialize` services the identity the catalogue would have given them. */
export const applyLegacyServiceFallback = (startup: StartupData, baseUrl?: string): void => {
  startup.categories?.forEach((category) => category.services?.forEach((service) => applyLegacyIdentity(service, baseUrl)));
  startup.allServices?.forEach((service) => applyLegacyIdentity(service, baseUrl));
};
