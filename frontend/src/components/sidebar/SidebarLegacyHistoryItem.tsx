import React from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';
import ChatIcon from '../../assets/icons/ChatIcon';
import { HistoryItem } from '../../models/startup';
import { ThemeColors } from '../WeaveAiChat';

interface SidebarLegacyHistoryItemProps {
  item: HistoryItem;
  isActive: boolean;
  isMobile: boolean;
  isArabic: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  themeColors: ThemeColors;
  onSelect: (item: HistoryItem) => void;
  onToggleSelection?: () => void;
  onDelete: (id: string) => void;
}

export const SidebarLegacyHistoryItem: React.FC<SidebarLegacyHistoryItemProps> = ({
  item,
  isActive,
  isMobile,
  isArabic,
  isSelected = false,
  isSelectionMode = false,
  themeColors,
  onSelect,
  onToggleSelection,
  onDelete,
}) => (
  <div
    className={twMerge(
      'sidebar-history-item flex items-start group cursor-pointer rounded-lg relative',
      isActive && 'sidebar-history-item--active',
      isSelected && 'sidebar-history-item--checked',
      isSelectionMode && 'sidebar-history-item--selecting',
      !isActive && !isSelected && 'hover:bg-[#FFF4E0]',
    )}
  >
    <button
      {...(isMobile
        ? {
            onTouchStart: (e: React.TouchEvent) => {
              e.stopPropagation();
              if (isSelectionMode) onToggleSelection?.();
              else onSelect(item);
            },
          }
        : {
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation();
              if (isSelectionMode) onToggleSelection?.();
              else onSelect(item);
            },
          })}
      className={`flex-1 px-2 py-2.5 flex items-start gap-2 min-w-0 ${
        isArabic ? 'text-right' : 'text-left'
      }`}
    >
      <div
        className={twMerge(
          'sidebar-chat-icon relative w-9 h-9 mr-0 flex-shrink-0 rounded-lg flex items-center justify-center',
          isActive && !isSelected && !isSelectionMode
            ? 'text-white'
            : 'bg-white border border-gray-200 text-[#344054]',
          isMobile ? 'mt-1' : 'mt-0.5',
        )}
        style={
          isActive && !isSelected && !isSelectionMode
            ? { backgroundColor: themeColors.primary }
            : undefined
        }
      >
        <span className="sidebar-chat-icon-glyph inline-flex">
          <ChatIcon className="w-5 h-5" />
        </span>
        <span
          role="checkbox"
          aria-checked={isSelected}
          className={twMerge(
            'sidebar-select-check',
            isSelected && 'sidebar-select-check--checked',
          )}
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
            onToggleSelection?.();
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          {isSelected && <CheckIcon className="w-4 h-4 text-white" strokeWidth={2.6} />}
        </span>
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <p
          className={twMerge(
            'text-sm truncate text-[#000000]',
            isMobile ? 'font-bold' : 'font-medium',
          )}
        >
          {item.title}
        </p>
        {item.message && (
          <p className="text-xs truncate mt-0.5 max-w-full text-[#4D4D4D]">
            {item.message}
          </p>
        )}
        <p className="text-xs truncate text-[#4D4D4D]">
          {new Date(item.timestamp).toLocaleDateString()}
        </p>
      </div>
    </button>
    {!isSelectionMode && (
      <button
        onClick={e => {
          e.stopPropagation();
          onDelete(item.id);
        }}
        className={`absolute top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-[#98A2B3] hover:text-[#D92D20] hover:bg-red-50 rounded-lg ${
          isArabic ? 'left-2' : 'right-2'
        }`}
        title="Delete chat"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.325.418C2.675 4.77 2 5.77 2 6.828V15.75A2.25 2.25 0 004.25 18h11.5A2.25 2.25 0 0018 15.75V6.828c0-1.058-.674-2.058-1.675-2.217-.745-.198-1.53-.341-2.325-.418v-.443A2.75 2.75 0 0011.25 1h-2.5zM7.5 3.75c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25V4h-5v-.25zM16.5 6.828V15.75a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75V6.828a1.74 1.74 0 01.644-.491 19.002 19.002 0 0111.212 0 1.74 1.74 0 01.644.491zM12.75 10.75a.75.75 0 10-1.5 0v4.5a.75.75 0 001.5 0v-4.5zm-4 0a.75.75 0 10-1.5 0v4.5a.75.75 0 001.5 0v-4.5z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    )}
  </div>
);
