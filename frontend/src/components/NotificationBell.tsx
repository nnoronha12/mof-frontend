import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';
import {
  AppNotification,
  buildAppNotifications,
  markAllNotificationsSeen,
  markNotificationsSeen,
  NOTIFICATIONS_SEEN_STORAGE_KEY,
} from '../utils/notifications';
import { CHAT_HISTORY_META_STORAGE_KEY } from '../utils/chatHistoryMeta';
import { ApiConfig, SharedChatMemberGroup } from '../models/startup';
import { BackendService } from '../services/backendService';

interface NotificationBellProps {
  isArabic?: boolean;
  userEmail?: string;
  apiConfig?: ApiConfig;
  themeColors?: { primary: string };
  className?: string;
  onOpenShared?: () => void;
  onSelectNotification?: (notification: AppNotification) => void;
}

function formatRelativeTime(iso: string, isArabic: boolean): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return isArabic ? 'الآن' : 'Just now';
  if (mins < 60) return isArabic ? `منذ ${mins} د` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isArabic ? `منذ ${hours} س` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return isArabic ? `منذ ${days} ي` : `${days}d ago`;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  isArabic = false,
  userEmail,
  apiConfig,
  themeColors = { primary: '#B68A35' },
  className,
  onOpenShared,
  onSelectNotification,
}) => {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [sharedChatGroups, setSharedChatGroups] = useState<SharedChatMemberGroup[]>([]);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const notifications = useMemo(
    () => buildAppNotifications(userEmail, isArabic, sharedChatGroups),
    [userEmail, isArabic, sharedChatGroups, tick],
  );
  const unreadCount = notifications.filter(n => n.unread).length;

  const refresh = useCallback(() => setTick(v => v + 1), []);

  const loadSharedChatNotifications = useCallback(async () => {
    if (!apiConfig?.baseUrl) {
      setSharedChatGroups([]);
      return;
    }

    const backendService = new BackendService(apiConfig.baseUrl, apiConfig.headers);
    const response = await backendService.getSharedChatSessions();
    setSharedChatGroups(response.success ? response.data ?? [] : []);
  }, [apiConfig]);

  const updatePanelPosition = useCallback(() => {
    const bell = rootRef.current?.querySelector('.mof-notify-bell') as HTMLElement | null;
    if (!bell) return;
    const rect = bell.getBoundingClientRect();
    const panelWidth = Math.min(352, window.innerWidth - 24);
    let left = rect.right - panelWidth;
    if (left < 12) left = Math.min(rect.left, window.innerWidth - panelWidth - 12);
    left = Math.max(12, Math.min(left, window.innerWidth - panelWidth - 12));
    const top = Math.min(rect.bottom + 8, window.innerHeight - 24);
    setPanelStyle({
      position: 'fixed',
      top,
      left,
      width: panelWidth,
      zIndex: 200,
    });
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === CHAT_HISTORY_META_STORAGE_KEY ||
        e.key === NOTIFICATIONS_SEEN_STORAGE_KEY
      ) {
        refresh();
      }
    };
    window.addEventListener('storage', onStorage);
    const id = window.setInterval(refresh, 8000);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(id);
    };
  }, [refresh]);

  useEffect(() => {
    void loadSharedChatNotifications();
    const id = window.setInterval(() => {
      void loadSharedChatNotifications();
    }, 15000);
    return () => window.clearInterval(id);
  }, [loadSharedChatNotifications]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
  }, [open, updatePanelPosition, notifications.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onReposition = () => updatePanelPosition();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updatePanelPosition]);

  const handleOpen = () => {
    if (!open) {
      const bell = rootRef.current?.querySelector('.mof-notify-bell') as HTMLElement | null;
      if (bell) {
        const rect = bell.getBoundingClientRect();
        const panelWidth = Math.min(352, window.innerWidth - 24);
        let left = rect.right - panelWidth;
        if (left < 12) left = Math.min(rect.left, window.innerWidth - panelWidth - 12);
        left = Math.max(12, Math.min(left, window.innerWidth - panelWidth - 12));
        const top = Math.min(rect.bottom + 8, window.innerHeight - 24);
        setPanelStyle({ position: 'fixed', top, left, width: panelWidth, zIndex: 200 });
      }
    }
    setOpen(prev => !prev);
  };

  const handleMarkAll = () => {
    markAllNotificationsSeen(notifications);
    refresh();
  };

  const handleSelect = (notification: AppNotification) => {
    markNotificationsSeen([notification.id]);
    refresh();
    setOpen(false);
    onSelectNotification?.(notification);
    if (!onSelectNotification) {
      onOpenShared?.();
    }
  };

  return (
    <div ref={rootRef} className={twMerge('relative', className)}>
      <button
        type="button"
        onClick={handleOpen}
        className="mof-notify-bell relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EAECF0] bg-white text-[#667085] shadow-sm transition-colors hover:border-[rgba(182,138,53,0.45)] hover:text-[#B68A35]"
        aria-label={isArabic ? 'الإشعارات' : 'Notifications'}
        aria-expanded={open}
      >
        <BellIcon className="h-5 w-5" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -end-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full text-[10px] font-bold text-white inline-flex items-center justify-center leading-none"
            style={{ backgroundColor: themeColors.primary }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="mof-notify-panel overflow-hidden rounded-xl border border-[#EAECF0] bg-white shadow-[0_12px_40px_rgba(16,24,40,0.12)]"
          style={panelStyle}
          dir={isArabic ? 'rtl' : 'ltr'}
          role="dialog"
          aria-label={isArabic ? 'الإشعارات' : 'Notifications'}
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#F2F4F7] px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[#101828] m-0">
                {isArabic ? 'الإشعارات' : 'Notifications'}
              </p>
              <p className="mt-0.5 text-[11px] text-[#667085] m-0">
                {isArabic
                  ? 'دعوات المساحات والمحادثات المشتركة'
                  : 'Workspace invites and shared chats'}
              </p>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-[11px] font-semibold text-[#B68A35] hover:text-[#9A7429] whitespace-nowrap"
              >
                {isArabic ? 'تعليم الكل كمقروء' : 'Mark all read'}
              </button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <BellIcon className="mx-auto mb-2 h-8 w-8 text-[#D0D5DD]" strokeWidth={1.5} />
                <p className="text-sm font-medium text-[#344054] m-0">
                  {isArabic ? 'لا توجد إشعارات' : 'No notifications yet'}
                </p>
                <p className="mt-1 text-xs text-[#98A2B3] m-0">
                  {isArabic
                    ? 'ستظهر هنا دعوات المساحات والمشاركات الجديدة'
                    : 'Workspace invites and new shares will appear here'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#F2F4F7] m-0 p-0 list-none">
                {notifications.map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={twMerge(
                        'w-full px-4 py-3 text-start transition-colors hover:bg-[#FFF9F0]',
                        item.unread && 'bg-[rgba(182,138,53,0.06)]',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: item.unread
                              ? themeColors.primary
                              : "#F2F4F7",
                            color: item.unread ? "#FFFFFF" : "#667085",
                          }}
                        >
                          <BellIcon className="h-4 w-4" strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span
                              className={twMerge(
                                'truncate text-[13px] text-[#101828]',
                                item.unread ? 'font-bold' : 'font-semibold',
                              )}
                              dir="auto"
                            >
                              {item.title}
                            </span>
                            {item.unread && (
                              <span
                                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                style={{ backgroundColor: themeColors.primary }}
                              />
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-[#475467]" dir="auto">
                            {item.body}
                          </span>
                          <span className="mt-1 block text-[10px] font-medium text-[#98A2B3]">
                            {formatRelativeTime(item.timestamp, isArabic)}
                          </span>
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {onOpenShared && notifications.length > 0 && (
            <div className="border-t border-[#F2F4F7] px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenShared();
                }}
                className="w-full rounded-lg px-3 py-2 text-center text-xs font-semibold text-[#B68A35] hover:bg-[#FFF9F0]"
              >
                {isArabic ? 'عرض المشاركات' : 'View shared'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
