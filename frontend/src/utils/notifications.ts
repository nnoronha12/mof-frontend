import {
  CHAT_HISTORY_META_STORAGE_KEY,
} from './chatHistoryMeta';
import { SharedChatMemberGroup } from '../models/startup';

export const NOTIFICATIONS_SEEN_STORAGE_KEY = 'weave-notifications-seen';

export type AppNotificationType = 'workspace_invite' | 'share_received';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  body: string;
  timestamp: string;
  chatId?: string;
  unread: boolean;
}

function loadSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<string>): void {
  localStorage.setItem(NOTIFICATIONS_SEEN_STORAGE_KEY, JSON.stringify([...ids]));
}

export function markNotificationsSeen(ids: string[]): void {
  const seen = loadSeenIds();
  ids.forEach(id => seen.add(id));
  saveSeenIds(seen);
}

export function markAllNotificationsSeen(notifications: AppNotification[]): void {
  markNotificationsSeen(notifications.map(n => n.id));
}

function fromSharedChats(
  groups: SharedChatMemberGroup[],
  seen: Set<string>,
  isArabic: boolean,
): AppNotification[] {
  return groups.flatMap(group =>
    group.conversations
      .filter(conversation => conversation.direction.toLowerCase() === 'received')
      .map(conversation => {
        const sender = conversation.otherUserName || group.name || conversation.otherUserEmail || group.email;
        const id = `shared-chat:${conversation.otherUserId}:${conversation.chatSessionId}`;
        return {
          id,
          type: 'share_received' as const,
          title: conversation.title || (isArabic ? 'محادثة مشتركة جديدة' : 'New shared chat'),
          body: isArabic
            ? `شارك ${sender} محادثة معك`
            : `${sender} shared a chat with you`,
          timestamp: conversation.sharedAt,
          chatId: String(conversation.chatSessionId),
          unread: !seen.has(id),
        };
      }),
  );
}

export function buildAppNotifications(
  userEmail?: string,
  isArabic = false,
  sharedChatGroups: SharedChatMemberGroup[] = [],
): AppNotification[] {
  const seen = loadSeenIds();
  const items: AppNotification[] = fromSharedChats(sharedChatGroups, seen, isArabic);

  const byKey = new Map<string, AppNotification>();
  for (const item of items) {
    const key = item.chatId || item.id;
    const existing = byKey.get(key);
    if (!existing || (item.type === 'workspace_invite' && existing.type !== 'workspace_invite')) {
      byKey.set(key, item);
    }
  }

  const resolved = [...byKey.values()].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return resolved;
}

export function getUnreadNotificationCount(
  userEmail?: string,
  isArabic = false,
  sharedChatGroups: SharedChatMemberGroup[] = [],
): number {
  return buildAppNotifications(userEmail, isArabic, sharedChatGroups).filter(n => n.unread).length;
}
