/** Deployment settings compiled in from config/portalConfig.cjs. */
interface PortalConfig {
  publicBasePath?: string;
  apiBaseUrl: string;
  websocketUrl: string;
  generalChatRoute: string;
  voiceTranscriptionRoute: string;
  /** Chat route per service slug, used only when the service catalogue is unavailable. */
  fallbackServiceRoutes: Record<string, string>;
}

declare const __MOF_PORTAL_CONFIG__: PortalConfig | undefined;

if (typeof __MOF_PORTAL_CONFIG__ !== 'object' || !__MOF_PORTAL_CONFIG__) {
  throw new Error('Portal config is missing: build through webpack or Vite so config/portalConfig.cjs is applied.');
}

const PORTAL_CONFIG: PortalConfig = __MOF_PORTAL_CONFIG__;

export const PUBLIC_BASE_PATH = PORTAL_CONFIG.publicBasePath || '/';

export const API_BASE_URL = PORTAL_CONFIG.apiBaseUrl;

/** Socket.IO relay for async n8n responses. Empty string disables WebSocket. */
export const WEBSOCKET_URL = PORTAL_CONFIG.websocketUrl;

/**
 * Absolute URL for a route after `/ai` or `/webhook`. Absolute routes pass through;
 * a bare origin retains the legacy `/ai` gateway convention.
 */
export const apiRouteUrl = (route: string, baseUrl: string = API_BASE_URL): string => {
  const path = route.trim();
  if (/^https?:\/\//i.test(path)) return path;
  const base = (baseUrl || API_BASE_URL).replace(/\/+$/, '');
  return `${/\/(ai|webhook)$/.test(base) ? base : `${base}/ai`}/${path.replace(/^\/+/, '')}`;
};

/** n8n Chat Trigger for General chat; also the route of any service without its own. */
export const GENERAL_CHAT_WEBHOOK_URL = apiRouteUrl(PORTAL_CONFIG.generalChatRoute);

export const VOICE_TRANSCRIPTION_ROUTE = PORTAL_CONFIG.voiceTranscriptionRoute;

export const FALLBACK_SERVICE_ROUTES: Readonly<Record<string, string>> = PORTAL_CONFIG.fallbackServiceRoutes;

/** Base for the Presentation Deck API (`ppt/*` routes). */
export const getPptWebhookBaseUrl = (): string => API_BASE_URL;

/** Public, browser-reachable image/font route exposed by the PPT Deck API. */
export const getPptAssetBaseUrl = (): string => `${API_BASE_URL}/ppt/asset?path=`;

export const getProposalEvaluateWebhookUrl = (baseUrl?: string): string =>
  apiRouteUrl('rfp/evaluate', baseUrl);

export const getProposalReportWebhookUrl = (baseUrl?: string): string =>
  apiRouteUrl('rfp/report', baseUrl);

export const MOF_BRANDMARK_SRC =
  `${PUBLIC_BASE_PATH}UAE_MOF_brandmark_Horizontal_CMYK_E-1-scaled-removebg-preview.png`;
export const HISTORY_ICON_SRC = `${PUBLIC_BASE_PATH}2961948.png`;
