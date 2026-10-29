import { ApiResponse } from '../models/api';
import {
  ChatHistoryDetail,
  StartupData,
  UserLookupItem,
  ChatSession,
  Service,
  SharedChatMemberGroup,
} from '../models/startup';
import { authFetch, getAccessToken } from './authSession';
import { GENERAL_CHAT_WEBHOOK_URL, VOICE_TRANSCRIPTION_ROUTE } from '../constants/chatConstants';
import { applyLegacyServiceFallback } from './serviceCatalogue';

export interface InquiryAdminDocument {
  document_id: string;
  document_family_id?: string | null;
  supersedes_document_id?: string | null;
  original_filename: string;
  title: string;
  department: string;
  language?: string;
  doc_version: string;
  version_number: number;
  version_count: number;
  status: string;
  stage: string;
  progress_pct?: number;
  page_count?: number;
  access_scope: 'authenticated' | 'department' | 'private';
  blob_available?: boolean;
  updated_at?: string;
}

export interface InquiryAdminListResponse {
  success: boolean;
  authorized: boolean;
  documents: InquiryAdminDocument[];
  departments: string[];
}

export interface ProposalFrameworkCriterion {
  criterion: string;
  weight: number;
  guidance: string;
}

export interface ProposalFrameworkInput {
  id?: string;
  name: string;
  description: string;
  /** Free text the evaluator matches against uploaded RFPs to pick this framework. */
  appliesTo: string;
  language: 'en' | 'ar';
  criteria: ProposalFrameworkCriterion[];
  sourceFilename?: string;
  sourceText?: string;
}

export interface ProposalFramework extends ProposalFrameworkInput {
  id: string;
  active: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface ProposalFrameworkDraft {
  draft: Omit<ProposalFrameworkInput, 'id' | 'sourceFilename' | 'sourceText'>;
  notes: string[];
  sourceFilename: string;
  sourceText: string;
}

/** Thrown by the framework admin calls; `status` lets the UI pick a localized message. */
export class ProposalFrameworkError extends Error {
  constructor(readonly status: number) {
    super(`Proposal framework request failed: ${status}`);
  }
}

const emptyApiResponse = <T>(data: T): ApiResponse<T> => ({
  success: true,
  responseTimeStamp: new Date().toISOString(),
  data,
  errors: [],
  validationErrors: [],
  validationInfo: [],
});

export class BackendService {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string, headers?: Record<string, string>) {
    this.baseUrl = (baseUrl || '').replace(/\/$/, '');
    this.headers = {
      "Content-Type": "application/json",
      ...headers,
    };
  }

  private apiPath(path: string): string {
    const suffix = path.replace(/^\//, '').replace(/^(?:ai|webhook)\//, '');
    if (/\/(ai|webhook)$/.test(this.baseUrl)) {
      return `${this.baseUrl}/${suffix}`;
    }
    return `${this.baseUrl}/ai/${suffix}`;
  }

  private getToken(): string {
    return getAccessToken() || this.headers['Token'] || this.headers['token'] || '';
  }

  private authHeaders(includeJson = true): Record<string, string> {
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) {
      headers.Token = token;
    }
    if (includeJson) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  private unwrapList<T>(responseData: unknown): T[] {
    if (Array.isArray(responseData)) {
      const first = responseData[0] as { data?: T[]; Data?: T[] } | undefined;
      if (first && Array.isArray(first.data)) return first.data;
      if (first && Array.isArray(first.Data)) return first.Data;
      return responseData as T[];
    }

    if (responseData && typeof responseData === 'object') {
      const record = responseData as { data?: T[]; Data?: T[] };
      if (Array.isArray(record.data)) return record.data;
      if (Array.isArray(record.Data)) return record.Data;
    }

    return [];
  }

  private async FetchAudioTranscriptData<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers();
    if (this.headers["Token"]) {
      headers.set("token", this.headers["Token"]);
    }
    const response = await authFetch(this.apiPath(endpoint), {
      ...options,
      headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json() as T;
  }

  /**
   * Replaces the static service list with the signed-in user's catalogue from
   * `GET user/services`. Returns false when it cannot be loaded, so the caller can fall back.
   */
  private async applyServiceCatalogue(data: StartupData): Promise<boolean> {
    try {
      const response = await authFetch(this.apiPath('user/services'), {
        method: 'GET',
        headers: this.authHeaders(true),
      });
      if (!response.ok) return false;
      const body = await response.json() as ApiResponse<Pick<StartupData, 'categories' | 'allServices'>>;
      const catalogue = body?.success ? body.data : null;
      if (!catalogue || !Array.isArray(catalogue.allServices) || catalogue.allServices.length === 0) return false;
      const resolve = (service: Service) => {
        const route = (service.chatRoute ?? '').trim();
        service.webHookUrl = !route
          ? GENERAL_CHAT_WEBHOOK_URL
          : /^https?:\/\//i.test(route)
            ? route
            : this.apiPath(route.replace(/^\/+/, ''));
      };
      catalogue.allServices.forEach(resolve);
      // Category entries are separate objects in the response, so resolve them too.
      catalogue.categories?.forEach((category) => category.services?.forEach(resolve));
      data.categories = catalogue.categories ?? [];
      data.allServices = catalogue.allServices;
      return true;
    } catch (error) {
      console.warn('Service catalogue unavailable, using the static list.', error);
      return false;
    }
  }

  async getStartupData(): Promise<ApiResponse<StartupData>> {
    const response = await authFetch(this.apiPath('user/initialize'), {
      method: 'GET',
      headers: this.authHeaders(true),
    });
    if (!response.ok) {
      throw new Error(`Startup request failed: ${response.status} ${response.statusText}`);
    }
    const result = await response.json() as ApiResponse<StartupData> | ApiResponse<StartupData>[];
    const startup = Array.isArray(result) ? result[0] : result;
    if (startup?.data) {
      // The static payload's General chat URL is stale; the deployment config is authoritative.
      startup.data.generalChatWebhookUrl = GENERAL_CHAT_WEBHOOK_URL;
      if (!await this.applyServiceCatalogue(startup.data)) {
        // The static list has no allServices; retired services only come from the catalogue.
        if (!startup.data.allServices?.length) {
          startup.data.allServices = (startup.data.categories ?? []).flatMap((category) => category.services ?? []);
        }
        applyLegacyServiceFallback(startup.data, this.baseUrl);
      }
    }
    return startup;
  }

  async PostAudioTranscript(data: FormData): Promise<{ text: string }[]> {
    return this.FetchAudioTranscriptData<{ text: string }[]>(VOICE_TRANSCRIPTION_ROUTE, {
      method: "POST",
      body: data,
    });
  }

  async togglePinnedService(serviceId: number): Promise<ApiResponse<boolean>> {
    return emptyApiResponse(true);
  }

  async getChatSessions(): Promise<{ success: boolean; data?: ChatSession[] }> {
    try {
      const response = await authFetch(this.apiPath('user/chat/session'), {
        method: "GET",
        headers: this.authHeaders(true),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      // The workflow returns service_id as text ("2"), and ids elsewhere are numbers.
      const data = this.unwrapList<ChatSession>(await response.json()).map((session) => ({
        ...session,
        serviceId: Number(session.serviceId) || 0,
      }));
      return { success: true, data };
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
      return { success: false };
    }
  }

  async deleteChatSession(sessionId: number): Promise<{ success: boolean }> {
    if (!sessionId || Number.isNaN(sessionId)) {
      return { success: false };
    }

    try {
      const response = await authFetch(this.apiPath(`user/chat/session/${sessionId}`), {
        method: "DELETE",
        headers: this.authHeaders(false),
      });

      if (response.ok || response.status === 204) {
        return { success: true };
      }

      if (response.status === 404 || response.status === 405) {
        const fallback = await authFetch(this.apiPath(`user/chat/session?id=${sessionId}`), {
          method: "DELETE",
          headers: this.authHeaders(false),
        });
        if (fallback.ok || fallback.status === 204) {
          return { success: true };
        }
      }

      console.error("API Error Deleting Session:", await response.text());
      return { success: false };
    } catch (error) {
      console.error("Error deleting chat session:", sessionId, error);
      return { success: false };
    }
  }

  async getChatHistoryDetail(
    sessionId: number
  ): Promise<{ success: boolean; data?: ChatHistoryDetail[] }> {
    try {
      const urls = [this.apiPath(`chat/history?id=${sessionId}`)];

      for (const url of urls) {
        const response = await authFetch(url, {
          method: "GET",
          headers: this.authHeaders(true),
        });
        if (!response.ok) continue;

        // A chat with no saved messages comes back as one blank row
        // ({ id: null, ... }); keep only real messages.
        const data = this.unwrapList<ChatHistoryDetail>(await response.json()).filter(
          (detail) =>
            detail != null &&
            detail.id != null &&
            Number.isFinite(Number(detail.id)) &&
            Boolean(detail.createdDate)
        );
        return { success: true, data };
      }

      return { success: true, data: [] };
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
      return { success: false };
    }
  }

  /**
   * Attachments are protected resources. Fetching the blob here keeps the
   * GoTrue access token in the Token header instead of exposing it in a URL.
   */
  async downloadChatAttachment(attachmentId: number): Promise<Blob> {
    const response = await authFetch(
      this.apiPath(`chat/file?id=${encodeURIComponent(String(attachmentId))}`),
      {
        method: 'GET',
        headers: this.authHeaders(false),
      }
    );

    if (!response.ok) {
      throw new Error(`Attachment download failed: ${response.status}`);
    }

    return response.blob();
  }

  async getInquiryAdminDocuments(): Promise<InquiryAdminListResponse> {
    // The legacy document list alone does not prove administrator membership.
    // The framework endpoint enforces the existing active mof_ai_admins role.
    await this.listProposalFrameworks();
    const response = await authFetch(this.apiPath('inquiry/document/admin/list'), {
      method: 'GET',
      headers: this.authHeaders(false),
    });
    if (!response.ok) {
      throw new Error(`Inquiry document list failed: ${response.status}`);
    }
    const payload = await response.json();
    return {
      success: payload?.success === true,
      authorized: payload?.success === true && payload?.authorized === true,
      documents: Array.isArray(payload?.documents) ? payload.documents : [],
      departments: Array.isArray(payload?.departments) ? payload.departments : [],
    };
  }

  async uploadInquiryDocument(input: {
    file: File;
    department: string;
    language: 'en' | 'ar';
    title: string;
    accessScope: 'authenticated' | 'department' | 'private';
    versionLabel?: string;
    replaceDocumentId?: string;
  }): Promise<Record<string, unknown>> {
    const body = new FormData();
    body.append('file', input.file, input.file.name);
    body.append('department', input.department);
    body.append('language', input.language);
    body.append('title', input.title);
    body.append('accessScope', input.accessScope);
    if (input.versionLabel) body.append('versionLabel', input.versionLabel);
    if (input.replaceDocumentId) body.append('replaceDocumentId', input.replaceDocumentId);

    const response = await authFetch(this.apiPath('inquiry/document/upload'), {
      method: 'POST',
      headers: this.authHeaders(false),
      body,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success !== true) {
      throw new Error('Unable to upload the document.');
    }
    return payload;
  }

  async deleteInquiryDocument(documentId: string): Promise<Record<string, unknown>> {
    const response = await authFetch(this.apiPath('inquiry/document/admin/delete'), {
      method: 'DELETE',
      headers: this.authHeaders(true),
      body: JSON.stringify({ documentId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success !== true) {
      throw new Error('Unable to delete the document.');
    }
    return payload;
  }

  async downloadInquiryDocument(documentId: string): Promise<Blob> {
    const query = new URLSearchParams({ documentId });
    const response = await authFetch(
      this.apiPath(`inquiry/document/admin/download?${query.toString()}`),
      {
        method: 'GET',
        headers: this.authHeaders(false),
      },
    );
    if (!response.ok) {
      throw new Error('Unable to download the document.');
    }
    return response.blob();
  }

  async listProposalFrameworks(): Promise<ProposalFramework[]> {
    const response = await authFetch(this.apiPath('rfp/admin/framework'), {
      method: 'GET',
      headers: this.authHeaders(false),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success !== true || payload?.authorized !== true) {
      throw new ProposalFrameworkError(response.status);
    }
    return Array.isArray(payload.frameworks) ? payload.frameworks : [];
  }

  async extractProposalFramework(file: File, language: 'en' | 'ar'): Promise<ProposalFrameworkDraft> {
    const body = new FormData();
    body.append('action', 'extract');
    body.append('language', language);
    body.append('file', file, file.name);
    const response = await authFetch(this.apiPath('rfp/admin/framework'), {
      method: 'POST',
      headers: this.authHeaders(false),
      body,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success !== true || !payload.draft) {
      throw new ProposalFrameworkError(response.status);
    }
    return {
      draft: payload.draft,
      notes: Array.isArray(payload.notes) ? payload.notes : [],
      sourceFilename: String(payload.sourceFilename ?? file.name),
      sourceText: String(payload.sourceText ?? ''),
    };
  }

  async saveProposalFramework(framework: ProposalFrameworkInput): Promise<string> {
    const response = await authFetch(this.apiPath('rfp/admin/framework'), {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify({ action: 'save', framework }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success !== true) {
      throw new ProposalFrameworkError(response.status);
    }
    return String(payload.id);
  }

  async setProposalFrameworkActive(id: string, active: boolean): Promise<void> {
    const response = await authFetch(this.apiPath('rfp/admin/framework'), {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify({ action: 'setActive', id, active }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success !== true) {
      throw new ProposalFrameworkError(response.status);
    }
  }

  async deleteAllChatSessions(): Promise<{ success: boolean }> {
    try {
      const listed = await this.getChatSessions();
      const sessions = listed.data || [];
      if (!listed.success) {
        return { success: false };
      }
      if (sessions.length === 0) {
        return { success: true };
      }

      const results = await Promise.all(
        sessions.map((session) => this.deleteChatSession(session.id))
      );
      return { success: results.every((result) => result.success) };
    } catch (error) {
      console.error("Error deleting all chat sessions:", error);
      return { success: false };
    }
  }

  async likeChatMessage(_messageId: number): Promise<{ success: boolean }> {
    return { success: true };
  }

  async dislikeChatMessage(_messageId: number): Promise<{ success: boolean }> {
    return { success: true };
  }

  async shareChatSession(
    sessionId: number,
    targetUserId: string,
    serviceId?: number
  ): Promise<ApiResponse<number>> {
    const response = await authFetch(this.apiPath('user/chat/share'), {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify({ chatSessionId: sessionId, targetUserId, serviceId }),
    });
    const payload = await response.json();
    const result = Array.isArray(payload) ? payload[0] : payload;
    if (!response.ok) {
      return {
        success: false,
        data: 0,
        errors: result?.errors ?? ['Unable to share this chat.'],
        validationErrors: [],
        validationInfo: [],
        responseTimeStamp: new Date().toISOString(),
      };
    }
    return result as ApiResponse<number>;
  }

  async searchUsers(searchText: string): Promise<ApiResponse<UserLookupItem[]>> {
    const query = new URLSearchParams({ searchText: searchText.trim() });
    const response = await authFetch(this.apiPath(`user/search?${query}`), {
      method: 'GET',
      headers: this.authHeaders(false),
    });
    const payload = await response.json();
    const result = Array.isArray(payload) ? payload[0] : payload;
    if (!response.ok) {
      return {
        success: false,
        data: [],
        errors: result?.errors ?? ['Unable to search users.'],
        validationErrors: [],
        validationInfo: [],
        responseTimeStamp: new Date().toISOString(),
      };
    }
    return result as ApiResponse<UserLookupItem[]>;
  }

  async getSharedChatSessions(): Promise<{ success: boolean; data?: SharedChatMemberGroup[] }> {
    try {
      const response = await authFetch(this.apiPath('user/chat/shared'), {
        method: 'GET',
        headers: this.authHeaders(false),
      });

      if (!response.ok) {
        console.error('Unable to load shared chats:', await response.text());
        return { success: false, data: [] };
      }

      const payload = await response.json();
      const result = Array.isArray(payload) ? payload[0] : payload;
      const groups = Array.isArray(result?.data) ? result.data : [];
      // A shared-chat entry is valid only when it points to a real shared
      // conversation. This prevents empty/default rows from appearing for a
      // newly created account.
      const data = groups
        .map((group: SharedChatMemberGroup) => ({
          ...group,
          conversations: (group.conversations ?? []).filter(conversation =>
            Number.isFinite(Number(conversation.chatSessionId)) &&
            Number(conversation.chatSessionId) > 0 &&
            Boolean(String(conversation.otherUserId ?? '').trim()),
          ),
        }))
        .filter((group: SharedChatMemberGroup) => group.conversations.length > 0);
      return { success: Boolean(result?.success), data };
    } catch (error) {
      console.error('Error loading shared chats:', error);
      return { success: false, data: [] };
    }
  }
}
