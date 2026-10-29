import { v4 as uuidv4 } from 'uuid';
import { getAccessToken, refreshAuthSession } from './authSession';
import { parseWebhookBody } from './chatPayload';
import type { PresentationDescriptor } from './presentationWorkflow';
import type { ProposalRecommendation } from './proposalWorkflow';
import type { TranslationDescriptor } from './translationWorkflow';
import type { EmailDraft } from './emailDraft';
import type { ChatAction } from './chatEnvelope';

/** Document ingestion runs inline in n8n, so uploads need far longer than a chat turn. */
const UPLOAD_TIMEOUT_MS = 300_000;
/** A chat POST is non-idempotent: never retry it after transport failure. */
const CHAT_REQUEST_TIMEOUT_MS = 300_000;

interface N8nChatMessage {
  action: 'sendMessage' | 'uploadFile' | { type: string; payload: Record<string, unknown> };
  sessionId: string;
  clientMessageId?: string;
  requestId: string;
  chatInput?: string;
  socketId?: string | null;
  language: 'en' | 'ar';
  webSearch: boolean;
  metadata: {
    email: string;
    token: string;
    weaveChatid: number | null;
    isMobile?: boolean;
    socketId?: string | null;
    modelCode?: string;
    /** Catalogue id of the use case this chat belongs to; absent for General chat. */
    serviceId?: number;
  };
}

export interface N8nChatResponse {
  schemaVersion?: string;
  eventType?: 'accepted' | 'progress' | 'message' | 'error';
  responseType?: string;
  citations?: Array<Record<string, any>>;
  output: string;
  emailDraft?: EmailDraft | null;
  presentationHtml?: string;
  presentation?: PresentationDescriptor | null;
  recommendation?: ProposalRecommendation | null;
  translation?: TranslationDescriptor | null;
  intermediateSteps: Array<{
    action: {
      tool: string;
      toolInput: Record<string, any>;
      toolCallId: string;
      log: string;
      messageLog: Array<{
        lc: number;
        type: string;
        id: string[];
        kwargs: Record<string, any>;
      }>;
    };
    observation: string;
  }>;
  actionButtons?: {
    buttons: ChatAction[];
  };
  sessionDetails?: {
    messageId: number;
    sessionId: string;
    weaveChatid: number;
    userMessageId: number;
    aiMessageId: number;
    chatLock: boolean;
    chatLockMessage?: string;
    chatLockAnimation?: string;
    download: boolean;
    fileName: string;
    chartDisplay: boolean;
    chartType: number;
    altType: number[];
    chartData: ChartData;
  };
}

export class N8nChatService {
  private webhookUrl: string;
  private sessionId: string;
  private weaveChatid: number | null = null;
  private email: string;
  private customHeaders: Record<string, string> | undefined;
  private webSearch: boolean = false;
  private ismobile: boolean = false;
  private modelCode: string | null = null;
  private serviceId = 0;
  private socketId: string | null = null;
  private socketConnector: (() => Promise<string | null>) | null = null;
  private language: 'en' | 'ar' = 'en';

  constructor(
    webhookUrl: string,
    email: string = 'demo.weave@solutionsplus.ae',
    sessionId: string | null = null,
    headers: Record<string, string> | undefined = undefined,
    modelCode: string | null = null,
    serviceId = 0
  ) {
    this.webhookUrl = webhookUrl;
    this.sessionId = sessionId ?? uuidv4();
    this.email = email;
    this.customHeaders = headers;
    this.modelCode = modelCode;
    this.serviceId = Number.isFinite(serviceId) && serviceId > 0 ? serviceId : 0;
  }

  getWebhookUrl(): string {
    return this.webhookUrl;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getEmail(): string {
    const token = getAccessToken() || this.customHeaders?.['Token'] || this.customHeaders?.['token'] || '';
    try {
      const encodedPayload = token.split('.')[1];
      if (encodedPayload) {
        const normalized = encodedPayload
          .replace(/-/g, '+')
          .replace(/_/g, '/')
          .padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=');
        const payload = JSON.parse(atob(normalized));
        if (typeof payload.email === 'string' && payload.email.trim()) {
          return payload.email.trim().toLowerCase();
        }
      }
    } catch {
      // Fall back to the email supplied by the host application.
    }
    return this.email;
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  setweaveChatid(weaveChatid: number): void {
    this.weaveChatid = weaveChatid;
  }

  setwebSearchTrue(websearch: boolean): void {
    this.webSearch = websearch;
  }

  setIsMobile(isMobile: boolean): void {
    this.ismobile = isMobile;
  }

  getIsMobile(): boolean {
    return this.ismobile;
  }

  set(sessionId: string): void {
    this.setSessionId(sessionId);
  }

  getCustomHeaders(): Record<string, string> | undefined {
    const token = getAccessToken() || this.customHeaders?.['Token'] || this.customHeaders?.['token'];
    return token ? { ...this.customHeaders, Token: token, token } : this.customHeaders;
  }

  setModelCode(modelCode: string | null): void {
    this.modelCode = modelCode?.trim() || null;
  }

  getModelCode(): string | null {
    return this.modelCode;
  }

  setServiceId(serviceId: number | null | undefined): void {
    this.serviceId = Number.isFinite(serviceId) && Number(serviceId) > 0 ? Number(serviceId) : 0;
  }

  getServiceId(): number {
    return this.serviceId;
  }

  setSocketId(socketId: string | null): void {
    this.socketId = socketId;
  }

  setSocketConnector(connector: () => Promise<string | null>): void {
    this.socketConnector = connector;
  }

  /** Both text and file turns must establish their reply channel before POST. */
  async ensureSocketReady(): Promise<void> {
    if (this.socketConnector) this.socketId = await this.socketConnector();
  }

  setLanguage(language: 'en' | 'ar'): void {
    this.language = language;
  }

  getSocketId(): string | null {
    return this.socketId;
  }

  getLanguage(): 'en' | 'ar' {
    return this.language;
  }

  getUploadMetadata(additionalData: Record<string, unknown> = {}): Record<string, unknown> {
    return this.buildMetadata(additionalData);
  }

  private async parseResponseBody(response: Response): Promise<N8nChatResponse> {
    const text = await response.text();
    return parseWebhookBody(text);
  }

  private buildMetadata(additionalData: Record<string, unknown> = {}): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      email: this.getEmail(),
      token: getAccessToken() || this.customHeaders?.['Token'] || this.customHeaders?.['token'] || '',
      weaveChatid: this.weaveChatid,
      isMobile: this.ismobile,
      socketId: this.socketId,
      clientSessionId: this.sessionId,
      language: this.language,
      // Lets history be stored under the use case. Explicit values in additionalData win.
      ...(this.serviceId > 0 ? { serviceId: this.serviceId } : {}),
      ...additionalData,
    };

    if (this.modelCode) {
      metadata.modelCode = this.modelCode;
    }

    return metadata;
  }

  /** Uploads use the same timeout ceiling as chat, without exposing workflow internals to users. */
  private async fetchWithTimeout(
    request: (signal: AbortSignal) => Promise<Response>,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await request(controller.signal);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async sendMessage(message: string, additionalData: Record<string, unknown> = {}): Promise<N8nChatResponse> {
    const clientMessageId = String(additionalData.clientMessageId || uuidv4());
    const buildPayload = (): N8nChatMessage => ({
      action: (additionalData.presentationAction as N8nChatMessage['action']) || 'sendMessage',
      sessionId: this.sessionId,
      clientMessageId,
      requestId: clientMessageId,
      socketId: this.socketId,
      chatInput: message,
      language: this.language,
      webSearch: this.webSearch,
      metadata: this.buildMetadata({ ...additionalData, clientMessageId, requestId: clientMessageId }) as N8nChatMessage['metadata'],
    });
    try {
      await refreshAuthSession(false);
      const perform = async () => {
        await this.ensureSocketReady();
        return this.fetchWithTimeout(
        (signal) => fetch(this.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Token: getAccessToken(),
          },
          body: JSON.stringify(buildPayload()),
          signal,
        }),
        CHAT_REQUEST_TIMEOUT_MS,
        );
      };
      let response = await perform();
      if (response.status === 401 && await refreshAuthSession(true)) response = await perform();

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      return await this.parseResponseBody(response);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async uploadFiles(files: File[], additionalData: Record<string, unknown> = {}): Promise<N8nChatResponse> {
    const clientMessageId = String(additionalData.clientMessageId || uuidv4());
    await refreshAuthSession(false);

    const perform = async () => {
      await this.ensureSocketReady();
      const formData = new FormData();
      formData.append('action', 'sendMessage');
      formData.append('sessionId', this.sessionId);
      formData.append('clientMessageId', clientMessageId);
      formData.append('requestId', clientMessageId);
      formData.append('socketId', this.socketId || '');
      formData.append('chatInput', String(additionalData.chatInput ?? ''));
      formData.append('language', this.language);
      formData.append('webSearch', String(this.webSearch));
      formData.append('metadata', JSON.stringify(this.buildMetadata({ clientMessageId, requestId: clientMessageId })));

      for (const [key, value] of Object.entries(additionalData)) {
        if (key !== 'chatInput' && key !== 'clientMessageId' && key !== 'requestId' && value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      }

      for (const file of files) {
        formData.append('files', file, file.name);
      }

      const headers = new Headers();
      const token = getAccessToken() || this.customHeaders?.['Token'] || this.customHeaders?.['token'];
      if (token) {
        headers.set('Token', token);
      }

      // Deliberately send this straight to the same n8n chat webhook used by
      // text messages. Do not set Content-Type: the browser must add the
      // multipart boundary for n8n to receive the binary fields.
      return this.fetchWithTimeout(
        (signal) => fetch(this.webhookUrl, { method: 'POST', headers, body: formData, signal }),
        UPLOAD_TIMEOUT_MS,
      );
    };

    try {
      let response = await perform();
      if (response.status === 401 && await refreshAuthSession(true)) {
        response = await perform();
      }

      if (!response.ok) {
        // Do not surface n8n/HTTP/database response bodies in the UI.
        throw new Error('UPLOAD_FAILED');
      }

      return await this.parseResponseBody(response);
    } catch (error) {
      console.error("Error uploading files:", error);
      throw error;
    }
  }

  async uploadFile(file: File): Promise<N8nChatResponse> {
    return this.uploadFiles([file]);
  }
}

/** Chart payload from the chart tool; see `components/AmCharts/chartModel.ts`. */
export interface ChartData {
  data: Array<Record<string, unknown>>;
  xField: string;
  yField?: string;
  series: Series[];
  title?: string;
  subtitle?: string;
  xAxisTitle?: string;
  yAxisTitle?: string;
  unit?: string;
}

export interface Series {
  type?: string;
  name: string;
  valueYField: string;
  categoryXField?: string;
  unit?: string;
}
