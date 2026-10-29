/** A chat from History, as far as usage counting needs it. */
export interface ServiceUse {
  serviceId: number | string | null | undefined;
  createdDate?: string;
  isSharedCopy?: boolean;
}

/**
 * Service ids the user has used most, from their own chats in History:
 * most chats first, then the most recently used. General chat (no service id),
 * chats shared with the user, and services not in `eligibleIds` are left out.
 */
export const rankServicesByUse = (
  sessions: ServiceUse[],
  eligibleIds: ReadonlySet<number>,
): number[] => {
  const usage = new Map<number, { count: number; lastUsed: number }>();
  for (const session of sessions) {
    if (session.isSharedCopy) continue;
    const id = Number(session.serviceId) || 0;
    if (id <= 0 || !eligibleIds.has(id)) continue;
    const used = Date.parse(session.createdDate ?? '') || 0;
    const entry = usage.get(id) ?? { count: 0, lastUsed: 0 };
    entry.count += 1;
    entry.lastUsed = Math.max(entry.lastUsed, used);
    usage.set(id, entry);
  }
  return [...usage.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.lastUsed - a.lastUsed)
    .map(([id]) => id);
};
