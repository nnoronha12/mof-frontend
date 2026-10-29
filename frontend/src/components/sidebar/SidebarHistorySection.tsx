import React from 'react';
import { ThemeColors } from '../WeaveAiChat';
import { SidebarHistoryFilterChips } from './SidebarHistoryFilterChips';
import { SidebarHistoryList } from './SidebarHistoryList';
import { SidebarHistorySearch } from './SidebarHistorySearch';
import { SidebarHistoryTabs } from './SidebarHistoryTabs';
import { SidebarSharedFilterTabs } from './SidebarSharedFilterTabs';
import { SidebarHistoryController } from './useSidebarHistory';

interface SidebarHistorySectionProps {
  controller: SidebarHistoryController;
  isMobile: boolean;
  isArabic: boolean;
  themeColors: ThemeColors;
  secondaryLighter: string;
  t: (key: string) => string;
}

export const SidebarHistorySection: React.FC<SidebarHistorySectionProps> = ({
  controller,
  isMobile,
  isArabic,
  themeColors,
  t,
}) => {
  const {
    features,
    enhancedHistoryEnabled,
    sidebarTab,
    sharedTabCount,
    isDeletingAll,
    setShowDeleteConfirm,
    handleSidebarTabChange,
    handleSearchChange,
    searchQuery,
    historyFilter,
    handleFilterChange,
    sharedDirectionFilter,
    handleSharedDirectionFilterChange,
    isSelectionMode,
    selectedChatIds,
    startChatSelection,
    clearChatSelection,
    selectAllVisibleChats,
    setShowBulkDeleteConfirm,
  } = controller;

  const {
    sharedTabEnabled,
    historySearchEnabled,
    historyFilterChipsEnabled,
  } = features;

  return (
    <div className={enhancedHistoryEnabled ? 'mt-2' : 'mt-6'}>
      <div
        className={`py-3 border-[#EAECF0] ${
          isMobile ? 'px-6' : enhancedHistoryEnabled ? 'px-3' : 'px-4'
        }`}
      >
        {sharedTabEnabled ? (
          <SidebarHistoryTabs
            activeTab={sidebarTab}
            sharedTabCount={sharedTabCount}
            isArabic={isArabic}
            historyLabel={t('History')}
            sharedLabel={t('SharedTab')}
            onTabChange={handleSidebarTabChange}
          />
        ) : (
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-bold text-[#101828]">{t('History')}</h2>
            {isSelectionMode ? (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={selectAllVisibleChats}
                  className="text-[11px] font-medium text-[#667085] hover:text-[#101828] transition-colors"
                >
                  {t('SelectAll')}
                </button>
                <button
                  type="button"
                  onClick={clearChatSelection}
                  className="text-[11px] font-medium text-[#667085] hover:text-[#101828] transition-colors"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="text-[11px] font-medium text-[#F04438] hover:text-[#D92D20] transition-colors"
                >
                  {t('DeleteSelected')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={startChatSelection}
                  className="sidebar-select-entry text-[11px] font-medium text-[#667085] hover:text-[#101828] transition-colors"
                >
                  {t('Select')}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeletingAll}
                  className="text-[11px] font-medium text-[#F04438] hover:text-[#D92D20] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('DeleteAll')}
                </button>
              </div>
            )}
          </div>
        )}

        {sharedTabEnabled && sidebarTab === 'history' && (
          <div className="flex items-center justify-end mb-2 min-h-[22px]">
            {isSelectionMode ? (
              <div className="w-full flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-[#101828]">
                  {t('SelectedCount').replace(
                    '{count}',
                    String(selectedChatIds.size),
                  )}
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={selectAllVisibleChats}
                    className="text-[11px] font-medium text-[#667085] hover:text-[#101828] transition-colors"
                  >
                    {t('SelectAll')}
                  </button>
                  <button
                    type="button"
                    onClick={clearChatSelection}
                    className="text-[11px] font-medium text-[#667085] hover:text-[#101828] transition-colors"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    className="text-[11px] font-medium text-[#F04438] hover:text-[#D92D20] transition-colors"
                  >
                    {t('DeleteSelected')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={startChatSelection}
                  className="sidebar-select-entry text-[11px] font-medium text-[#667085] hover:text-[#101828] transition-colors"
                >
                  {t('Select')}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeletingAll}
                  className="text-[11px] font-medium text-[#F04438] hover:text-[#D92D20] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('DeleteAll')}
                </button>
              </div>
            )}
          </div>
        )}

        {historySearchEnabled && (
          <SidebarHistorySearch
            value={searchQuery}
            placeholder={
              sidebarTab === 'history'
                ? t('SearchChatsWithDots')
                : t('SearchSharedWithDots')
            }
            isArabic={isArabic}
            themeColors={themeColors}
            onChange={handleSearchChange}
          />
        )}

        {historyFilterChipsEnabled && sidebarTab === 'history' && (
          <SidebarHistoryFilterChips
            activeFilter={historyFilter}
            isArabic={isArabic}
            onFilterChange={handleFilterChange}
          />
        )}

        {sidebarTab === 'shared' && (
          <SidebarSharedFilterTabs
            activeFilter={sharedDirectionFilter}
            isArabic={isArabic}
            onFilterChange={handleSharedDirectionFilterChange}
          />
        )}

        <div className="space-y-1">
          <SidebarHistoryList
            controller={controller}
            isMobile={isMobile}
            isArabic={isArabic}
            themeColors={themeColors}
            t={t}
          />
        </div>
      </div>
    </div>
  );
};
