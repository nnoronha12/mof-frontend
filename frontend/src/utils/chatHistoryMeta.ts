export const CHAT_HISTORY_META_STORAGE_KEY = 'weave-chat-history-meta';

export interface SharedCollaborator {
  id: string;
  name: string;
  email: string;
  username?: string;
  department?: string;
}

export interface SharedWorkspaceRecord {
  chatId: string;
  title: string;
  ownerName: string;
  ownerEmail: string;
  sharedAt: string;
}

export interface InvitedWorkspaceView {
  id: string;
  workspaceChatId: string;
  title: string;
  ownerName: string;
  previewMessage?: string;
  sharedAt: string;
  inviteeEmail: string;
}

export interface ChatHistoryMeta {
  customTitles: Record<string, string>;
  pinnedIds: string[];
  sharedWith: Record<string, SharedCollaborator[]>;
  sharedWorkspaces: Record<string, SharedWorkspaceRecord>;
  invitedViews: InvitedWorkspaceView[];
}

const defaultMeta = (): ChatHistoryMeta => ({
  customTitles: {},
  pinnedIds: [],
  sharedWith: {},
  sharedWorkspaces: {},
  invitedViews: [],
});

export function loadChatHistoryMeta(): ChatHistoryMeta {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_META_STORAGE_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw) as Partial<ChatHistoryMeta>;
    return {
      customTitles: parsed.customTitles ?? {},
      pinnedIds: parsed.pinnedIds ?? [],
      sharedWith: parsed.sharedWith ?? {},
      sharedWorkspaces: parsed.sharedWorkspaces ?? {},
      invitedViews: parsed.invitedViews ?? [],
    };
  } catch {
    return defaultMeta();
  }
}

export function saveChatHistoryMeta(meta: ChatHistoryMeta): void {
  localStorage.setItem(CHAT_HISTORY_META_STORAGE_KEY, JSON.stringify(meta));
}

export function getCustomTitle(meta: ChatHistoryMeta, id: string): string | undefined {
  return meta.customTitles[id]?.trim() || undefined;
}

export function setCustomTitle(meta: ChatHistoryMeta, id: string, title: string): ChatHistoryMeta {
  const next = { ...meta, customTitles: { ...meta.customTitles } };
  const trimmed = title.trim();
  if (trimmed) {
    next.customTitles[id] = trimmed;
  } else {
    delete next.customTitles[id];
  }
  saveChatHistoryMeta(next);
  return next;
}

export function isPinned(meta: ChatHistoryMeta, id: string): boolean {
  return meta.pinnedIds.includes(id);
}

export function togglePin(meta: ChatHistoryMeta, id: string): ChatHistoryMeta {
  const pinnedIds = meta.pinnedIds.includes(id)
    ? meta.pinnedIds.filter(pid => pid !== id)
    : [id, ...meta.pinnedIds];
  const next = { ...meta, pinnedIds };
  saveChatHistoryMeta(next);
  return next;
}

export function getSharedWith(meta: ChatHistoryMeta, id: string): SharedCollaborator[] {
  return meta.sharedWith[id] ?? [];
}

export function isSharedWorkspace(meta: ChatHistoryMeta, id: string): boolean {
  return Boolean(meta.sharedWorkspaces[id]);
}

export function getSharedWorkspace(meta: ChatHistoryMeta, id: string): SharedWorkspaceRecord | undefined {
  return meta.sharedWorkspaces[id];
}

export function addSharedUser(
  meta: ChatHistoryMeta,
  id: string,
  user: SharedCollaborator,
): ChatHistoryMeta {
  const existing = meta.sharedWith[id] ?? [];
  if (existing.some(u => u.id === user.id)) return meta;
  const next = {
    ...meta,
    sharedWith: { ...meta.sharedWith, [id]: [...existing, user] },
  };
  saveChatHistoryMeta(next);
  return next;
}

export function addSharedUsers(
  meta: ChatHistoryMeta,
  id: string,
  users: SharedCollaborator[],
): ChatHistoryMeta {
  return users.reduce((acc, user) => addSharedUser(acc, id, user), meta);
}

export function removeSharedUser(
  meta: ChatHistoryMeta,
  chatId: string,
  userId: string,
): ChatHistoryMeta {
  const existing = meta.sharedWith[chatId] ?? [];
  const removed = existing.find(u => u.id === userId);
  const nextShared = existing.filter(u => u.id !== userId);
  const next: ChatHistoryMeta = {
    ...meta,
    sharedWith: { ...meta.sharedWith, [chatId]: nextShared },
    invitedViews: meta.invitedViews.filter(
      view => !(view.workspaceChatId === chatId && removed && view.inviteeEmail === removed.email),
    ),
  };
  if (nextShared.length === 0) {
    delete next.sharedWith[chatId];
    delete next.sharedWorkspaces[chatId];
    next.invitedViews = next.invitedViews.filter(view => view.workspaceChatId !== chatId);
  }
  saveChatHistoryMeta(next);
  return next;
}

export function markSharedWorkspace(
  meta: ChatHistoryMeta,
  chatId: string,
  title: string,
  ownerName: string,
  ownerEmail: string,
): ChatHistoryMeta {
  const next = {
    ...meta,
    sharedWorkspaces: {
      ...meta.sharedWorkspaces,
      [chatId]: {
        chatId,
        title,
        ownerName,
        ownerEmail,
        sharedAt: new Date().toISOString(),
      },
    },
  };
  saveChatHistoryMeta(next);
  return next;
}

export function addInvitedWorkspaceViews(
  meta: ChatHistoryMeta,
  chatId: string,
  title: string,
  ownerName: string,
  previewMessage: string | undefined,
  invitees: SharedCollaborator[],
): ChatHistoryMeta {
  const existingIds = new Set(meta.invitedViews.map(v => v.id));
  const newViews: InvitedWorkspaceView[] = invitees
    .filter(user => !existingIds.has(`${chatId}-${user.email}`))
    .map(user => ({
      id: `${chatId}-${user.email}`,
      workspaceChatId: chatId,
      title,
      ownerName,
      previewMessage,
      sharedAt: new Date().toISOString(),
      inviteeEmail: user.email,
    }));

  const next = {
    ...meta,
    invitedViews: [...meta.invitedViews, ...newViews],
  };
  saveChatHistoryMeta(next);
  return next;
}

export function getInvitedViewsForEmail(meta: ChatHistoryMeta, email?: string): InvitedWorkspaceView[] {
  if (!email) return [];
  const normalized = email.trim().toLowerCase();
  return meta.invitedViews.filter(view => view.inviteeEmail.toLowerCase() === normalized);
}

export function removeHistoryMeta(meta: ChatHistoryMeta, id: string): ChatHistoryMeta {
  const next: ChatHistoryMeta = {
    customTitles: { ...meta.customTitles },
    pinnedIds: meta.pinnedIds.filter(pid => pid !== id),
    sharedWith: { ...meta.sharedWith },
    sharedWorkspaces: { ...meta.sharedWorkspaces },
    invitedViews: meta.invitedViews.filter(view => view.workspaceChatId !== id),
  };
  delete next.customTitles[id];
  delete next.sharedWith[id];
  delete next.sharedWorkspaces[id];
  saveChatHistoryMeta(next);
  return next;
}

export function clearAllHistoryMeta(): ChatHistoryMeta {
  const next = defaultMeta();
  saveChatHistoryMeta(next);
  return next;
}
