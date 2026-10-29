export interface ChatUiFeatures {
  chatShareEnabled?: boolean;
  sharedTabEnabled?: boolean;
  historySearchEnabled?: boolean;
  historyFilterChipsEnabled?: boolean;
  historyPinEnabled?: boolean;
  notificationsEnabled?: boolean;
  languageToggleEnabled?: boolean;
}

export const normalizeChatUiFeatures = (
  features?: Partial<ChatUiFeatures> | null,
): ChatUiFeatures => ({
  chatShareEnabled: features?.chatShareEnabled ?? true,
  // Keep collaboration controls available even while a stale startup payload
  // still sends the old disabled feature flags.
  sharedTabEnabled: true,
  historySearchEnabled: features?.historySearchEnabled ?? true,
  historyFilterChipsEnabled: features?.historyFilterChipsEnabled ?? true,
  historyPinEnabled: features?.historyPinEnabled ?? true,
  notificationsEnabled: true,
  languageToggleEnabled: features?.languageToggleEnabled ?? true,
});

export interface StartupData {
  categories: Category[];
  userPinnedServices: Service[];
  pinnedServices: PinnedService[];
  allServices: Service[];
  generalChatWebhookUrl: string;
  micRecordingAllowed: boolean;
  welcomeMessage: string;
  copyAllowed: boolean;
  likeDisLikeAllowed: boolean
  textToSpeechAllowed: boolean
  typeSpeedMilliSeconds: number
  welcomeMessageAr: string
  descriptionAr:string
  descriptionEn:string
  animation:boolean;
  webSocketEnabled?: boolean;
  defaultModelCode?: string;
  suggestions?: Suggestion[];
  chatUiFeatures?: ChatUiFeatures;
}

export interface Category {
  id: number;
  nameEn: string;
  nameAr: string;
  active: boolean;
  iconInternal: boolean;
  iconPath: string;
  services: Service[];
}

export interface Service {
  id: number;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  webHookUrl: string;
  categoryId: number;
  active: boolean;
  iconInternal: boolean;
  iconPath: string;
  questions: Question[];
  initialMessages: Question[];
  micRecordingAllowed: boolean;
  initialMessage?:Question;
  suggestions?:Suggestion[];
  sharable?: boolean;
  /** Stable key from the service catalogue (`user/services`); absent on the static fallback. */
  slug?: string;
  /** Path after `/ai`, an absolute URL, or null for General chat. Resolved into `webHookUrl`. */
  chatRoute?: string | null;
  /** live: usable, phase_two: greyed out, retired: only used to name old chats. */
  status?: 'live' | 'phase_two' | 'retired';
}

export interface UserLookupItem {
  id: string;
  name: string;
  nameAr: string;
  email: string;
}

export interface Question {
  id: number;
  questionEn: string;
  questionAr: string;
  isActive: boolean,
  serviceId: number,
  initialMessage: boolean
}

export interface UserPinnedService {
  serviceId: number;
}

export interface PinnedService {
  id: number;
  serviceId: number;
  active: boolean;
  service: Service;
} 

export interface ChatSession {
  id: number;
  chatSessionId: string;
  serviceId: number;
  service: Service | undefined;
  createdDate: string;
  message?: string;
  isSharedCopy?: boolean;
  isSentShare?: boolean;
  sentShareCount?: number;
  sharedByUserName?: string;
  sharedByUserEmail?: string;
  sharedFromSessionId?: number;
  sharedByUserId?: number;
}

export interface SharedChatConversation {
  direction: 'sent' | 'received';
  chatSessionId: number;
  chatSessionGuid: string;
  title: string;
  previewMessage?: string;
  sharedAt: string;
  otherUserId: string;
  otherUserName: string;
  otherUserEmail?: string;
}

export interface SharedChatMemberGroup {
  email: string;
  name: string;
  conversations: SharedChatConversation[];
}

export interface ApiConfig {
  baseUrl: string;
  headers?: Record<string, string>;
}

export interface ChatHistoryDetail {
  responsePayload?: any;
  id: number;
  chatSessionId: number;
  userMessage: boolean;
  message: string;
  liked: boolean;
  disliked: boolean;
  createdDate: string;
  chartJson?: string | {
    chartDisplay: boolean;
    chartType: number;
    altType: number[];
    chartData: unknown;
  } | null;
  /** Persisted chat uploads returned with the user message by n8n history. */
  attachments?: StoredChatAttachment[] | string | null;
  attachmentJson?: StoredChatAttachment[] | string | null;
}

export interface StoredChatAttachment {
  id: number;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

export interface HistoryItem {
  id: string;
  title: string;
  message?: string;
  timestamp: string;
  session: ChatSession;
}

export interface Suggestion {
  id: number;
  nameEn: string;
  nameAr: string;
}
