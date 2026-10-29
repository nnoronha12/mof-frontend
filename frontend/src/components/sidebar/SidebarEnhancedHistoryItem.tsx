import React from 'react';
import {
  CheckIcon,
  EllipsisHorizontalIcon,
  PencilSquareIcon,
  ShareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';
import PinnedIcon from '../../assets/icons/PinnedIcon';
import PinnedActiveIcon from '../../assets/icons/PinnedActiveIcon';
import ChatIcon from '../../assets/icons/ChatIcon';
import { EnrichedHistoryItem } from '../../utils/chatHistorySearch';
import { ThemeColors } from '../WeaveAiChat';

interface SidebarEnhancedHistoryItemProps {
  item: EnrichedHistoryItem;
  isActive: boolean;
  isMobile: boolean;
  isArabic: boolean;
  isRenaming: boolean;
  isSelected: boolean;
  isSelectionMode: boolean;
  renameValue: string;
  isMenuOpen: boolean;
  historyPinEnabled: boolean;
  chatShareEnabled: boolean;
  themeColors: ThemeColors;
  t: (key: string) => string;
  onSelect: () => void;
  onToggleSelection: () => void;
  onRenameValueChange: (value: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onStartRename: () => void;
  onToggleMenu: () => void;
  onTogglePin: () => void;
  onShare: () => void;
  onDelete: () => void;
}

export const SidebarEnhancedHistoryItem: React.FC<SidebarEnhancedHistoryItemProps> = ({
  item,
  isActive,
  isMobile,
  isArabic,
  isRenaming,
  isSelected,
  isSelectionMode,
  renameValue,
  isMenuOpen,
  historyPinEnabled,
  chatShareEnabled,
  themeColors,
  t,
  onSelect,
  onToggleSelection,
  onRenameValueChange,
  onSaveRename,
  onCancelRename,
  onStartRename,
  onToggleMenu,
  onTogglePin,
  onShare,
  onDelete,
}) => {
  const isReceivedCopy = item.session?.isSharedCopy;
  const isSentShare = item.session?.isSentShare;

  return (
    <div
      className={twMerge(
        'sidebar-history-item flex items-stretch group cursor-pointer rounded-lg relative transition-all duration-200',
        isActive && 'sidebar-history-item--active',
        isSelected && 'sidebar-history-item--checked',
        isSelectionMode && 'sidebar-history-item--selecting',
        isMenuOpen && 'z-30',
        !isActive && !isSelected && 'hover:bg-[#FFF4E0]',
        historyPinEnabled &&
          item.isPinned &&
          !isActive &&
          'border sidebar-history-item--pinned',
      )}
    >
      <button
        {...(isMobile
          ? {
              onTouchStart: (e: React.TouchEvent) => {
                e.stopPropagation();
                if (isRenaming) return;
                if (isSelectionMode) onToggleSelection();
                else onSelect();
              },
            }
          : {
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation();
                if (isRenaming) return;
                if ((e.target as HTMLElement).closest('.sidebar-select-check')) {
                  return;
                }
                if (isSelectionMode) onToggleSelection();
                else onSelect();
              },
            })}
        className={twMerge(
          'sidebar-history-btn flex-1 flex gap-2 min-w-0 px-3 py-2',
          isArabic ? 'text-right' : 'text-left',
        )}
      >
        <div
          className={twMerge(
            'sidebar-chat-icon relative w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
            isActive && !isSelected && !isSelectionMode
              ? 'text-white'
              : historyPinEnabled && item.isPinned
                ? 'text-[#C6A75D]'
                : 'bg-white border border-gray-200 text-[#667085]',
          )}
          style={
            isActive && !isSelected && !isSelectionMode
              ? { backgroundColor: themeColors.primary }
              : historyPinEnabled && item.isPinned && !isSelected
                ? {
                    backgroundColor: `${themeColors.primary}22`,
                    border: 'none',
                  }
                : undefined
          }
        >
          <span className="sidebar-chat-icon-glyph inline-flex">
            {historyPinEnabled && item.isPinned ? (
              <PinnedActiveIcon
                className="w-4 h-4"
                style={{
                  color: isActive && !isSelectionMode
                    ? 'white'
                    : 'var(--sidebar-pin-color, #6F5724)',
                }}
              />
            ) : (
              <ChatIcon className="w-5 h-5" />
            )}
          </span>
          <span
            role="checkbox"
            aria-checked={isSelected}
            aria-label={t('SelectChat')}
            className={twMerge(
              'sidebar-select-check',
              isSelected && 'sidebar-select-check--checked',
            )}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              onToggleSelection();
            }}
            onMouseDown={e => e.stopPropagation()}
          >
            {isSelected && <CheckIcon className="w-4 h-4 text-white" strokeWidth={2.6} />}
          </span>
        </div>
        <div className="flex-1 min-w-0 overflow-hidden leading-snug py-0.5">
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={e => onRenameValueChange(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter') onSaveRename();
                if (e.key === 'Escape') onCancelRename();
              }}
              onClick={e => e.stopPropagation()}
              className="w-full text-[13px] font-semibold px-2 py-1 border rounded bg-white text-[#1D2939] focus:outline-none focus:ring-1"
              style={{ borderColor: themeColors.primary }}
              dir="auto"
              autoFocus
            />
          ) : (
            <>
              <p
                className={twMerge(
                  'text-[13px] truncate font-semibold leading-snug sidebar-history-title',
                  isActive ? 'text-[#1D2939]' : 'text-[#344054]',
                )}
                dir="auto"
                onDoubleClick={e => {
                  e.stopPropagation();
                  if (historyPinEnabled) onStartRename();
                }}
              >
                {item.title}
              </p>
              {historyPinEnabled && item.isPinned && (
                <span className="sidebar-pinned-badge">
                  <PinnedActiveIcon className="w-3 h-3" />
                  {t('PinnedChats')}
                </span>
              )}
              {isReceivedCopy && (
                <span className="inline-flex mt-0.5 text-[9px] font-bold uppercase tracking-wide text-[#667085] bg-[#F2F4F7] px-1.5 py-0.5 rounded">
                  {t('SharedTagReceived')}
                </span>
              )}
              {isSentShare && !isReceivedCopy && (
                <span className="inline-flex mt-0.5 text-[9px] font-bold uppercase tracking-wide text-[#667085] bg-[#F2F4F7] px-1.5 py-0.5 rounded">
                  {t('SharedSentLabel')}
                </span>
              )}
              {item.message && (
                <p
                  className="text-[11px] truncate text-[#667085] leading-snug mt-0.5"
                  dir="auto"
                >
                  {item.message}
                </p>
              )}
              <div
                className={twMerge(
                  'sidebar-history-meta text-[10px] text-[#98A2B3]',
                  item.message ? 'mt-1' : 'mt-0.5',
                  isArabic && 'text-right',
                )}
              >
                {new Date(item.timestamp).toLocaleDateString()}
                {isSentShare && (item.session?.sentShareCount ?? 0) > 0 && (
                  <span>
                    {' · '}
                    {t('SharedSentTo')}{' '}
                    {item.session?.sentShareCount === 1
                      ? '1'
                      : `${item.session?.sentShareCount} ${t('Colleagues')}`}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </button>

      {(historyPinEnabled || chatShareEnabled) && !isSelectionMode && (
        <div
          className="sidebar-history-toolbar"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            type="button"
            className={twMerge(
              'sidebar-dots-btn',
              isMenuOpen && 'sidebar-dots-btn--open',
            )}
            onClick={e => {
              e.stopPropagation();
              onToggleMenu();
            }}
            title="More options"
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
          >
            <EllipsisHorizontalIcon className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div
              className={twMerge(
                'sidebar-item-menu',
                isArabic ? 'sidebar-item-menu--rtl' : '',
              )}
              role="menu"
              onMouseDown={e => e.stopPropagation()}
            >
              {historyPinEnabled && (
                <button
                  type="button"
                  className="sidebar-item-menu-btn"
                  onClick={e => {
                    e.stopPropagation();
                    onTogglePin();
                  }}
                >
                  {item.isPinned ? (
                    <PinnedActiveIcon
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: 'var(--sidebar-pin-color, #6F5724)' }}
                    />
                  ) : (
                    <PinnedIcon
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: themeColors.primary }}
                    />
                  )}
                  <span>{item.isPinned ? t('UnpinChat') : t('PinChat')}</span>
                </button>
              )}

              {chatShareEnabled && (
                <button
                  type="button"
                  className="sidebar-item-menu-btn"
                  onClick={e => {
                    e.stopPropagation();
                    onShare();
                  }}
                >
                  <ShareIcon className="w-4 h-4 flex-shrink-0" />
                  <span>{t('ShareChat')}</span>
                </button>
              )}

              {historyPinEnabled && (
                <button
                  type="button"
                  className="sidebar-item-menu-btn"
                  onClick={e => {
                    e.stopPropagation();
                    onStartRename();
                  }}
                >
                  <PencilSquareIcon className="w-4 h-4 flex-shrink-0" />
                  <span>{t('RenameChat')}</span>
                </button>
              )}

              <button
                type="button"
                className="sidebar-item-menu-btn sidebar-item-menu-btn--danger"
                onClick={e => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <TrashIcon className="w-4 h-4 flex-shrink-0" />
                <span>{t('DeleteChat')}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
