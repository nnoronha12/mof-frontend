import React from 'react';
import { ShareIcon } from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';
import { SharedChatConversation } from '../../models/startup';

interface SidebarSharedConversationRowProps {
  conversation: SharedChatConversation;
  isActive: boolean;
  isArabic: boolean;
  chatShareEnabled: boolean;
  t: (key: string) => string;
  onSelect: (conversation: SharedChatConversation) => void;
  onShare: (sessionId: number) => void;
}

export const SidebarSharedConversationRow: React.FC<
  SidebarSharedConversationRowProps
> = ({
  conversation,
  isActive,
  isArabic,
  chatShareEnabled,
  t,
  onSelect,
  onShare,
}) => {
  const isSent = conversation.direction.toLowerCase() === 'sent';
  const otherUser =
    conversation.otherUserName && conversation.otherUserName !== 'User'
      ? conversation.otherUserName
      : conversation.otherUserEmail?.split('@')[0];

  return (
    <div
      className={twMerge(
        'sidebar-shared-row group',
        isActive && 'sidebar-shared-row--active',
      )}
      onClick={() => onSelect(conversation)}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(conversation);
        }
      }}
    >
      <div
        className={twMerge(
          'sidebar-shared-row-icon',
          isSent
            ? 'sidebar-shared-row-icon--sent'
            : 'sidebar-shared-row-icon--received',
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-3.5 h-3.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0 overflow-hidden leading-snug">
        <p
          className="text-[13px] truncate font-semibold text-[#1D2939] leading-snug sidebar-history-title"
          dir="auto"
        >
          {conversation.title}
        </p>
        {conversation.previewMessage && (
          <p
            className="text-[11px] truncate text-[#667085] leading-snug mt-0.5"
            dir="auto"
          >
            {conversation.previewMessage}
          </p>
        )}
        {otherUser && (
          <p
            className={twMerge(
              'text-[10px] text-[#667085] leading-snug mt-0.5 truncate',
              isArabic && 'text-right',
            )}
          >
            {isSent ? 'Shared with' : 'Shared by'}: {otherUser}
          </p>
        )}
        <div
          className={twMerge(
            'sidebar-history-meta text-[10px] text-[#98A2B3] mt-0.5',
            isArabic && 'text-right',
          )}
        >
          {new Date(conversation.sharedAt).toLocaleDateString(undefined, {
            month: 'numeric',
            day: 'numeric',
          })}
        </div>
      </div>
      <div
        className={twMerge(
          'sidebar-shared-row-trailing',
          )}
      >
        <span
          className={twMerge(
            'sidebar-direction-tag',
            isSent
              ? 'sidebar-direction-tag--sent'
              : 'sidebar-direction-tag--received',
          )}
        >
          {isSent ? t('SharedTagSent') : t('SharedTagReceived')}
        </span>
        <div className="sidebar-shared-row-action">
          {isSent && chatShareEnabled && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onShare(conversation.chatSessionId);
              }}
              className={twMerge(
                'sidebar-shared-manage-btn',
                isActive
                  ? 'opacity-100'
                  : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto',
              )}
              title={t('ShareChat')}
            >
              <ShareIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
