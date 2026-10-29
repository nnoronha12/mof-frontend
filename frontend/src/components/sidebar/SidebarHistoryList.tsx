import React from 'react';
import { twMerge } from 'tailwind-merge';
import { HistoryItem } from '../../models/startup';
import { EnrichedHistoryItem } from '../../utils/chatHistorySearch';
import { TimelineGroupKey } from '../../utils/chatHistoryTimeline';
import { ThemeColors } from '../WeaveAiChat';
import { SidebarEnhancedHistoryItem } from './SidebarEnhancedHistoryItem';
import { SidebarLegacyHistoryItem } from './SidebarLegacyHistoryItem';
import {
  SidebarHistorySkeleton,
  SidebarSharedGroupsList,
} from './SidebarSharedGroupsList';
import { SidebarHistoryController } from './useSidebarHistory';

interface SidebarHistoryListProps {
  controller: SidebarHistoryController;
  isMobile: boolean;
  isArabic: boolean;
  themeColors: ThemeColors;
  t: (key: string) => string;
}

export const SidebarHistoryList: React.FC<SidebarHistoryListProps> = ({
  controller,
  isMobile,
  isArabic,
  themeColors,
  t,
}) => {
  const {
    features,
    enhancedHistoryEnabled,
    historyItems,
    isLoadingHistory,
    isLoadingShared,
    sidebarTab,
    activeHistoryItemId,
    renamingId,
    renameValue,
    setRenameValue,
    openMenuId,
    setOpenMenuId,
    setShareSessionId,
    setShareServiceId,
    activeShareServiceId,
    expandedSharedGroups,
    filteredSharedMemberGroups,
    pinnedItems,
    timelineGroups,
    searchResults,
    filteredItems,
    isSearching,
    timelineLabel,
    handleHistoryItemClick,
    handleSaveRename,
    handleStartRename,
    handleTogglePin,
    toggleSharedGroup,
    openSharedConversation,
    setDeleteConfirmItem,
    setRenamingId,
    selectedChatIds,
    isSelectionMode,
    toggleChatSelection,
  } = controller;

  const { sharedTabEnabled, historyPinEnabled, chatShareEnabled } = features;

  if (sidebarTab === 'shared' && sharedTabEnabled) {
    if (isLoadingShared && filteredSharedMemberGroups.length === 0) {
      return <SidebarHistorySkeleton />;
    }

    if (filteredSharedMemberGroups.length === 0) {
      return (
        <div className="text-center text-gray-500 text-sm py-6 px-2">
          {controller.searchQuery.trim() ? t('NoSearchResults') : t('SharedTabEmpty')}
        </div>
      );
    }

    return (
      <SidebarSharedGroupsList
        groups={filteredSharedMemberGroups}
        expandedGroups={expandedSharedGroups}
        activeHistoryItemId={activeHistoryItemId}
        isArabic={isArabic}
        chatShareEnabled={chatShareEnabled}
        themeColors={themeColors}
        t={t}
        onToggleGroup={toggleSharedGroup}
        onSelectConversation={openSharedConversation}
        onShare={setShareSessionId}
      />
    );
  }

  if (isLoadingHistory && !controller.hasLoadedHistoryOnce && historyItems.length === 0) {
    return <SidebarHistorySkeleton />;
  }

  const itemsToShow = enhancedHistoryEnabled ? filteredItems : historyItems;

  if (itemsToShow.length === 0) {
    return (
      <div className="text-center text-gray-500 text-sm py-4">
        {isSearching ? t('NoSearchResults') : t('NoChatHistoryFound')}
      </div>
    );
  }

  if (!enhancedHistoryEnabled) {
    return (
      <>
        {historyItems.map(item => (
          <SidebarLegacyHistoryItem
            key={item.id}
            item={item}
            isActive={activeHistoryItemId === item.id}
            isMobile={isMobile}
            isArabic={isArabic}
            isSelected={selectedChatIds.has(item.id)}
            isSelectionMode={isSelectionMode}
            themeColors={themeColors}
            onSelect={() =>
              isSelectionMode
                ? toggleChatSelection(item.id)
                : handleHistoryItemClick(item)
            }
            onToggleSelection={() => toggleChatSelection(item.id)}
            onDelete={() => setDeleteConfirmItem(item)}
          />
        ))}
        {isLoadingHistory && !controller.hasLoadedHistoryOnce && (
          <div className="flex justify-center py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-transparent"
              style={{ borderColor: themeColors.primary, borderTopColor: 'transparent' }}
            />
          </div>
        )}
      </>
    );
  }

  const renderEnhancedItem = (item: EnrichedHistoryItem) => (
    <SidebarEnhancedHistoryItem
      key={item.id}
      item={item}
      isActive={activeHistoryItemId === item.id}
      isMobile={isMobile}
      isArabic={isArabic}
      isRenaming={renamingId === item.id}
      isSelected={selectedChatIds.has(item.id)}
      isSelectionMode={isSelectionMode}
      renameValue={renameValue}
      isMenuOpen={openMenuId === item.id}
      historyPinEnabled={historyPinEnabled}
      chatShareEnabled={chatShareEnabled}
      themeColors={themeColors}
      t={t}
      onSelect={() =>
        isSelectionMode
          ? toggleChatSelection(item.id)
          : handleHistoryItemClick(item)
      }
      onToggleSelection={() => toggleChatSelection(item.id)}
      onRenameValueChange={setRenameValue}
      onSaveRename={() => handleSaveRename(item.id)}
      onCancelRename={() => {
        setRenamingId(null);
        setRenameValue('');
      }}
      onStartRename={() => {
        handleStartRename(item);
        setOpenMenuId(null);
      }}
      onToggleMenu={() =>
        setOpenMenuId(openMenuId === item.id ? null : item.id)
      }
      onTogglePin={() => {
        handleTogglePin(item.id);
        setOpenMenuId(null);
      }}
      onShare={() => {
        const sessionDbId = item.session?.id ?? parseInt(item.id, 10);
        const itemServiceId =
          item.session?.serviceId && item.session.serviceId > 0
            ? item.session.serviceId
            : undefined;
        setShareSessionId(sessionDbId);
        setShareServiceId(itemServiceId ?? activeShareServiceId);
        setOpenMenuId(null);
      }}
      onDelete={() => {
        setDeleteConfirmItem(item);
        setOpenMenuId(null);
      }}
    />
  );

  return (
    <>
      {isSearching ? (
        searchResults.map(item => renderEnhancedItem(item))
      ) : (
        <>
          {historyPinEnabled && pinnedItems.length > 0 && (
            <div className="sidebar-pinned-section mb-3">
              <p
                className={twMerge(
                  'sidebar-pinned-heading sidebar-timeline-label text-[10px] font-semibold uppercase text-[#667085]',
                  isArabic && 'text-right',
                )}
              >
                {t('PinnedChats')}
              </p>
              <div className="space-y-1">
                {pinnedItems.map(item => renderEnhancedItem(item))}
              </div>
            </div>
          )}
          {timelineGroups.map(group => (
            <div key={group.key} className="mb-1.5">
              <p
                className={twMerge(
                  'sidebar-timeline-label text-[10px] font-semibold uppercase text-[#98A2B3]',
                  isArabic && 'text-right',
                )}
              >
                {timelineLabel(group.key as TimelineGroupKey)}
              </p>
              <div className="space-y-1">
                {group.items.map(item => renderEnhancedItem(item))}
              </div>
            </div>
          ))}
        </>
      )}
      {isLoadingHistory && !controller.hasLoadedHistoryOnce && (
        <div className="flex justify-center py-2">
          <div
            className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2"
            style={{ borderColor: themeColors.primary }}
          />
        </div>
      )}
    </>
  );
};
