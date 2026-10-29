import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { ChevronDownIcon, PlusIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import PinnedActiveIcon from '../assets/icons/PinnedActiveIcon';
import {
  HistoryItem,
  Service,
  ChatSession,
  ApiConfig,
  ChatUiFeatures,
} from '../models/startup';
import { ChatCurrentUser, ThemeColors } from './WeaveAiChat';
import './Sidebar.css';
import tinycolor from 'tinycolor2';
import { motion } from 'framer-motion';
import { ShareChatModal } from './ShareChatModal';
import { SidebarConfirmModal } from './sidebar/SidebarConfirmModal';
import { SidebarHistorySection } from './sidebar/SidebarHistorySection';
import { useSidebarHistory } from './sidebar/useSidebarHistory';
import { getSidebarThemeVars } from './sidebar/sidebarTheme';
import { InquiryDocumentAdmin } from './InquiryDocumentAdmin';

interface SidebarProps {
  className?: string;
  onServiceSelect?: (serviceId: number) => void;
  onHistoryItemSelect?: (session: ChatSession) => void;
  AddHistoryItemChatSession?: (session: ChatSession) => void;
  onOpenDashboard?: () => void;
  onOpenEditor?: () => void;
  onExploreServices?: () => void;
  OnWiewAIServices?: () => void;
  onToggleSidebar?: () => void;
  isCollapsed?: boolean;
  toggleIcon?: React.ReactNode;
  userPinnedServices: Service[];
  apiConfig: ApiConfig;
  themeColors: ThemeColors;
  isExploreServicesVisible?: boolean;
  handlePinClick: (serviceId: number, isPinned: boolean) => void;
  onMobilePinnedServicesCLicked?: () => void;
  IsMobile: boolean;
  t: (key: string) => string;
  IsArabicLanguage: boolean;
  mobilePaddingTop?: string;
  mobilePaddingBottom?: string;
  chatUiFeatures?: ChatUiFeatures;
  currentUserEmail?: string;
  currentUser?: ChatCurrentUser;
  onLogout?: () => void;
  onOpenAdminPortal?: () => void;
  activeShareServiceId?: number;
  /** Live service catalogue, used to label history rows by use case. */
  services?: Array<{ id: number; nameEn?: string; nameAr?: string }>;
  /** Phones and tablets: show the sidebar as a drawer over the page instead of beside it. */
  overlay?: boolean;
  /** The user's chats from History, whenever the list changes. */
  onSessionsChange?: (sessions: ChatSession[]) => void;
}

export const Sidebar = React.forwardRef<
  {
    addHistoryItem: (item: HistoryItem) => void;
    replaceHistoryItem: (temporaryId: string, item: HistoryItem, activate?: boolean) => void;
    checkHistoryItemExists: (id: string) => boolean;
    openChatById: (chatId: string) => void;
    clearActiveHistoryItem: () => void;
  },
  SidebarProps
>(({
  className,
  onServiceSelect,
  onHistoryItemSelect,
  onOpenEditor,
  onExploreServices,
  onToggleSidebar,
  isCollapsed = false,
  toggleIcon,
  apiConfig,
  themeColors,
  isExploreServicesVisible,
  onMobilePinnedServicesCLicked,
  IsMobile,
  t,
  IsArabicLanguage,
  AddHistoryItemChatSession,
  mobilePaddingTop,
  mobilePaddingBottom,
  chatUiFeatures,
  currentUser,
  onLogout,
  onOpenAdminPortal,
  activeShareServiceId,
  services,
  overlay = false,
  onSessionsChange,
}, ref) => {
  const historyContainerRef = useRef<HTMLDivElement>(null);
  const [hasAnimatedIn, setHasAnimatedIn] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const secondaryLigher = tinycolor(themeColors.secondary).lighten(7).toString();
  const sidebarThemeVars = getSidebarThemeVars(themeColors);

  const historyController = useSidebarHistory({
    apiConfig,
    chatUiFeatures,
    isArabicLanguage: IsArabicLanguage,
    onHistoryItemSelect,
    onOpenEditor,
    addHistoryItemChatSession: AddHistoryItemChatSession,
    historyContainerRef,
    activeShareServiceId,
    services,
    onSessionsChange,
    t,
  });

  const {
    features,
    enhancedHistoryEnabled,
    showDeleteConfirm,
    setShowDeleteConfirm,
    isDeletingAll,
    deleteConfirmItem,
    setDeleteConfirmItem,
    isDeletingItem,
    shareSessionId,
    setShareSessionId,
    shareServiceId,
    setShareServiceId,
    addHistoryItem,
    replaceHistoryItem,
    checkHistoryItemExists,
    openChatById,
    clearActiveHistoryItem,
    fetchHistory,
    fetchSharedGroups,
    page,
    handleDeleteHistoryItem,
    handleConfirmDeleteAll,
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    isDeletingSelected,
    selectedChatIds,
    handleConfirmDeleteSelected,
  } = historyController;

  const { chatShareEnabled } = features;

  useEffect(() => {
    setHasAnimatedIn(true);
  }, []);

  // Escape closes the drawer.
  useEffect(() => {
    if (!overlay || isCollapsed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onToggleSidebar?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, isCollapsed, onToggleSidebar]);

  useImperativeHandle(
    ref,
    () => ({
      addHistoryItem,
      replaceHistoryItem,
      checkHistoryItemExists,
      openChatById,
      clearActiveHistoryItem,
    }),
    [addHistoryItem, replaceHistoryItem, checkHistoryItemExists, openChatById, clearActiveHistoryItem],
  );

  return (
    <>
      {overlay && !isCollapsed && (
        <div
          className="fixed inset-0 z-[60] bg-[#101828]/30"
          aria-hidden="true"
          onClick={onToggleSidebar}
        />
      )}
      <motion.div
        dir={IsArabicLanguage ? 'rtl' : 'ltr'}
        initial={{ x: IsArabicLanguage ? 250 : -250, opacity: 0 }}
        animate={hasAnimatedIn ? { x: 0, opacity: 1 } : {}}
        transition={{ type: 'spring', stiffness: 230, damping: 50 }}
        className={twMerge(
          'sidebar-panel border-r border-[#EAECF0] flex flex-col h-full will-change-[width] overflow-hidden',
          isCollapsed
            ? 'w-0 overflow-hidden transition-[width] duration-300 ease-in-out'
            : overlay
              ? 'w-[min(330px,85vw)] transition-[width] duration-300 ease-in-out'
              : ' min350:w-[352px] w-[400px] md:w-[330px] transition-[width] duration-300 ease-in-out ',
          enhancedHistoryEnabled ? 'bg-gray-50 glass-sidebar' : 'bg-white/70 glass-sidebar',
          overlay && 'fixed inset-y-0 start-0 z-[61] bg-gray-50 shadow-2xl',
          className,
        )}
        style={{
          ...(enhancedHistoryEnabled ? {} : { backdropFilter: 'blur(32px)' }),
          opacity: hasAnimatedIn ? 1 : 0,
          ...sidebarThemeVars,
          ...(IsMobile && {
            paddingTop: mobilePaddingTop,
            paddingBottom: mobilePaddingBottom,
          }),
        }}
      >
        <div
          style={{ color: themeColors.primary }}
          className={`flex items-center px-4 pt-3 pb-2 ${
            IsMobile ? 'pt-0' : ''
          }`}
        >
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-white/50 transition-colors group"
            title={isCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
          >
            {toggleIcon}
          </button>
        </div>

        <div className="px-5 pb-4 flex flex-col gap-2">
          <button
            onClick={onOpenEditor}
            className="h-10 w-full rounded-full flex items-center justify-center gap-2 text-sm font-semibold border transition-colors hover:bg-[#FFF4E0]"
            style={{
              color: themeColors.primary,
              backgroundColor: '#FFF9F0',
              borderColor: `${themeColors.primary}66`,
            }}
          >
            <PlusIcon className="w-4 h-4" strokeWidth={2.5} />
            <span>{t('NewChat')}</span>
          </button>
          {isExploreServicesVisible && (
            <button
              onClick={onExploreServices}
              className="h-10 w-full rounded-full flex items-center justify-center gap-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: themeColors.primary }}
            >
              <Squares2X2Icon className="w-4 h-4" />
              <span>{t('exploreServices')}</span>
            </button>
          )}
        </div>

        {IsMobile && (
          <div className="px-5 pb-2 text-[16px] font-bold bg-transparent">
            <div
              onClick={onMobilePinnedServicesCLicked}
              className="cursor-pointer flex items-center gap-3 justify-start px-1 py-2"
            >
              <PinnedActiveIcon
                className="w-5 h-5 transition-colors"
                style={{ color: themeColors.primary }}
              />
              <span>{t('PinnedServices')}</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto" ref={historyContainerRef}>
          <SidebarHistorySection
            controller={historyController}
            isMobile={IsMobile}
            isArabic={IsArabicLanguage}
            themeColors={themeColors}
            secondaryLighter={secondaryLigher}
            t={t}
          />
        </div>

        {currentUser && (
          <div
            className={`border-t border-[#EAECF0] ${IsMobile ? 'px-6' : 'px-4'} py-3 bg-white/70`}
            style={{ backdropFilter: 'blur(32px)' }}
          >
            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#FFF9F0] transition-all duration-200"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                  style={{ backgroundColor: themeColors.primary }}
                >
                  {currentUser.employee_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-[#101828] truncate">
                    {currentUser.employee_name || 'User'}
                  </p>
                  <p className="text-xs text-[#667085] truncate">
                    {currentUser.job_title || currentUser.department || ''}
                  </p>
                </div>
                <ChevronDownIcon
                  className={twMerge(
                    'h-4 w-4 text-[#98A2B3] transition-transform duration-200',
                    showProfileDropdown ? 'transform rotate-180' : '',
                  )}
                />
              </button>
              {showProfileDropdown && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-[#EAECF0] overflow-hidden z-50">
                  <div className="p-3 border-b border-[#EAECF0]">
                    <p className="text-xs font-medium text-[#667085]">Signed in as</p>
                    <p className="text-sm font-semibold text-[#101828] mt-1">
                      {currentUser.email || ''}
                    </p>
                  </div>
                  <InquiryDocumentAdmin
                    apiConfig={apiConfig}
                    isArabic={IsArabicLanguage}
                    themeColor={themeColors.primary}
                    variant="menu"
                    onOpenAdminPanel={() => {
                      setShowProfileDropdown(false);
                      onOpenAdminPortal?.();
                    }}
                  />
                  {onLogout && (
                    <button
                      onClick={() => {
                        setShowProfileDropdown(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-[#F04438] hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Sign Out
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {isCollapsed && (
        <div style={IsMobile ? { paddingTop: mobilePaddingTop } : {}}>
          <button
            onClick={onToggleSidebar}
            className={`absolute ${
              !IsMobile ? 'top-4' : ''
            } ${
              document?.dir === 'rtl' ? 'right-4' : 'left-4'
            } p-2 bg-white border border-[#EAECF0] shadow-sm hover:bg-[rgba(198,167,93,0.08)] transition-colors group z-50`}
          >
            <div className="flex items-center justify-center w-5 h-5">
              <span>{toggleIcon}</span>
            </div>
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <SidebarConfirmModal
          title={t('DeleteAllHistory')}
          message={t('DeleteChatHistoryMsg')}
          confirmLabel={t('DeleteAll')}
          cancelLabel={t('Cancel')}
          isBusy={isDeletingAll}
          onConfirm={handleConfirmDeleteAll}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {deleteConfirmItem && (
        <SidebarConfirmModal
          title={t('DeleteChat')}
          message={t('DeleteChatConfirm').replace('{title}', deleteConfirmItem.title)}
          confirmLabel={t('DeleteChat')}
          cancelLabel={t('Cancel')}
          isBusy={isDeletingItem}
          onConfirm={() => handleDeleteHistoryItem(deleteConfirmItem.id)}
          onCancel={() => setDeleteConfirmItem(null)}
        />
      )}

      {showBulkDeleteConfirm && (
        <SidebarConfirmModal
          title={t('DeleteSelected')}
          message={t('DeleteSelectedConfirm').replace(
            '{count}',
            String(selectedChatIds.size),
          )}
          confirmLabel={t('DeleteSelected')}
          cancelLabel={t('Cancel')}
          isBusy={isDeletingSelected}
          onConfirm={handleConfirmDeleteSelected}
          onCancel={() => setShowBulkDeleteConfirm(false)}
        />
      )}

      {chatShareEnabled && shareSessionId !== null && (
        <ShareChatModal
          isOpen={shareSessionId !== null}
          sessionId={shareSessionId}
          serviceId={shareServiceId}
          apiConfig={apiConfig}
          themeColors={themeColors}
          isArabicLanguage={IsArabicLanguage}
          t={t}
          onClose={() => {
            setShareSessionId(null);
            setShareServiceId(undefined);
          }}
          onShared={() => {
            fetchHistory();
            fetchSharedGroups();
          }}
        />
      )}
    </>
  );
});
