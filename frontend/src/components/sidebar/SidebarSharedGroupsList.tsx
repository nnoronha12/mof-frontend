import React from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';
import { SharedChatMemberGroup, SharedChatConversation } from '../../models/startup';
import { ThemeColors } from '../WeaveAiChat';
import { getInitials } from './types';
import { SidebarSharedConversationRow } from './SidebarSharedConversationRow';

interface SidebarSharedGroupsListProps {
  groups: SharedChatMemberGroup[];
  expandedGroups: Set<string>;
  activeHistoryItemId: string | null;
  isArabic: boolean;
  chatShareEnabled: boolean;
  themeColors: ThemeColors;
  t: (key: string) => string;
  onToggleGroup: (key: string) => void;
  onSelectConversation: (conversation: SharedChatConversation) => void;
  onShare: (sessionId: number) => void;
}

export const SidebarSharedGroupsList: React.FC<SidebarSharedGroupsListProps> = ({
  groups,
  expandedGroups,
  activeHistoryItemId,
  isArabic,
  chatShareEnabled,
  themeColors,
  t,
  onToggleGroup,
  onSelectConversation,
  onShare,
}) =>
  groups.map(group => {
    const groupKey = group.email || group.name;
    const isGroupCollapsed = !expandedGroups.has(groupKey);

    return (
      <div key={groupKey} className="mb-1.5">
        <button
          type="button"
          onClick={() => onToggleGroup(groupKey)}
          className={twMerge(
            'sidebar-member-header w-full',
          )}
        >
          <div
            className="sidebar-member-avatar flex-shrink-0"
            style={{
              backgroundColor: `${themeColors.primary}18`,
              color: themeColors.primary,
            }}
          >
            {getInitials(group.name)}
          </div>
          <div
            className={twMerge(
              'min-w-0 flex-1',
              isArabic ? 'text-right' : 'text-left',
            )}
          >
            <p className="text-[13px] font-semibold text-[#101828] truncate leading-tight">
              {group.name}
            </p>
            <p className="text-[11px] text-[#667085] truncate leading-tight">
              {group.email}
            </p>
          </div>
          <span className="sidebar-member-count flex-shrink-0">
            {group.conversations.length}
          </span>
          <ChevronDownIcon
            className={twMerge(
              'w-3.5 h-3.5 flex-shrink-0 text-[#98A2B3] transition-transform duration-200 ml-1',
              isGroupCollapsed ? '' : 'rotate-180',
              isArabic && 'ml-0 mr-1',
            )}
          />
        </button>
        {!isGroupCollapsed && (
          <div className="space-y-1 mt-1">
            {group.conversations.map(conversation => {
              const chatId = String(conversation.chatSessionId);
              const isActive =
                activeHistoryItemId === chatId ||
                activeHistoryItemId === conversation.chatSessionGuid;

              return (
                <SidebarSharedConversationRow
                  key={`${conversation.chatSessionId}-${conversation.direction}-${conversation.otherUserId}`}
                  conversation={conversation}
                  isActive={isActive}
                  isArabic={isArabic}
                  chatShareEnabled={chatShareEnabled}
                  t={t}
                  onSelect={onSelectConversation}
                  onShare={onShare}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  });

const SidebarHistorySkeleton: React.FC = () => (
  <div className="space-y-2">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="flex items-start space-x-3 p-2 animate-pulse">
        <div className="w-4 h-4 bg-gray-200 rounded flex-shrink-0 mt-1" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-3/4" />
          <div className="h-2 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

export { SidebarHistorySkeleton };
