import { useCallback, useEffect, useMemo, useRef, useState, RefObject } from 'react';
import {
  ApiConfig,
  ChatSession,
  ChatUiFeatures,
  HistoryItem,
  SharedChatConversation,
  SharedChatMemberGroup,
} from '../../models/startup';
import { BackendService } from '../../services/backendService';
import {
  filterHistoryItems,
  sortHistoryItems,
  EnrichedHistoryItem,
} from '../../utils/chatHistorySearch';
import {
  groupHistoryByTimeline,
  TimelineGroupKey,
} from '../../utils/chatHistoryTimeline';
import {
  loadChatHistoryMeta,
  getCustomTitle,
  setCustomTitle,
  isPinned,
  togglePin,
  removeHistoryMeta,
  ChatHistoryMeta,
} from '../../utils/chatHistoryMeta';
import {
  HistoryFilter,
  ResolvedSidebarFeatures,
  SharedDirectionFilter,
  resolveSidebarFeatures,
  SidebarTab,
} from './types';

const PAGE_SIZE = 10;

export interface UseSidebarHistoryOptions {
  apiConfig: ApiConfig;
  chatUiFeatures?: ChatUiFeatures;
  isArabicLanguage: boolean;
  onHistoryItemSelect?: (session: ChatSession) => void;
  onOpenEditor?: () => void;
  addHistoryItemChatSession?: (session: ChatSession) => void;
  historyContainerRef: RefObject<HTMLDivElement>;
  activeShareServiceId?: number;
  /** Live service catalogue; names the history rows by use case. */
  services?: Array<{ id: number; nameEn?: string; nameAr?: string }>;
  /** Called with the user's chats whenever the History list changes (used for frequently used services). */
  onSessionsChange?: (sessions: ChatSession[]) => void;
  t: (key: string) => string;
}

export const useSidebarHistory = ({
  apiConfig,
  chatUiFeatures,
  isArabicLanguage,
  onHistoryItemSelect,
  onOpenEditor,
  addHistoryItemChatSession,
  historyContainerRef,
  activeShareServiceId,
  services,
  onSessionsChange,
  t,
}: UseSidebarHistoryOptions) => {
  const features: ResolvedSidebarFeatures = resolveSidebarFeatures(chatUiFeatures);
  const {
    sharedTabEnabled,
    historySearchEnabled,
    historyFilterChipsEnabled,
    historyPinEnabled,
    chatShareEnabled,
    enhancedHistoryEnabled,
  } = features;

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [allHistoryItems, setAllHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasLoadedHistoryOnce, setHasLoadedHistoryOnce] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<HistoryItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [page, setPage] = useState(1);
  const [activeHistoryItemId, setActiveHistoryItemId] = useState<string | null>(null);
  const [historyMeta, setHistoryMeta] = useState<ChatHistoryMeta>(() => loadChatHistoryMeta());
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [shareSessionId, setShareSessionId] = useState<number | null>(null);
  const [shareServiceId, setShareServiceId] = useState<number | undefined>(undefined);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('history');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [sharedDirectionFilter, setSharedDirectionFilter] =
    useState<SharedDirectionFilter>('received');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedSharedGroups, setExpandedSharedGroups] = useState<Set<string>>(new Set());
  const [sharedMemberGroups, setSharedMemberGroups] = useState<SharedChatMemberGroup[]>([]);
  const [isLoadingShared, setIsLoadingShared] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  const addHistoryItemChatSessionRef = useRef(addHistoryItemChatSession);
  addHistoryItemChatSessionRef.current = addHistoryItemChatSession;

  const apiConfigRef = useRef(apiConfig);
  apiConfigRef.current = apiConfig;

  const isFetchingHistoryRef = useRef(false);
  const apiBaseUrl = apiConfig?.baseUrl ?? '';

  const sourceHistoryItems = enhancedHistoryEnabled ? allHistoryItems : historyItems;

  useEffect(() => {
    onSessionsChange?.(
      sourceHistoryItems
        .map(item => item.session)
        .filter((session): session is ChatSession => !!session),
    );
  }, [sourceHistoryItems, onSessionsChange]);

  const mapSessionsToHistoryItems = useCallback(
    (sessions: ChatSession[]): HistoryItem[] =>
      sessions
        .sort(
          (a, b) =>
            new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
        )
        .map(item => {
          // The live catalogue wins: the session list's service map is
          // hard-coded and only knows a few ids.
          const sessionServiceId = Number(item.serviceId) || 0;
          const catalogued =
            sessionServiceId > 0
              ? services?.find(service => Number(service.id) === sessionServiceId)
              : undefined;
          const label = (source?: { nameEn?: string; nameAr?: string }) =>
            (isArabicLanguage ? source?.nameAr || source?.nameEn : source?.nameEn) || '';
          return {
          id: item.id.toString(),
          title:
            label(catalogued) ||
            label(item.service) ||
            (isArabicLanguage ? 'دردشة عامة' : 'General Chat'),
          timestamp: item.createdDate,
          session: item,
          message: item.message,
        };
        }),
    [isArabicLanguage, services],
  );

  const fetchSharedGroups = useCallback(async () => {
    if (!apiConfig || !sharedTabEnabled) return;
    setIsLoadingShared(true);
    try {
      const backendService = new BackendService(apiConfig.baseUrl, apiConfig.headers);
      const response = await backendService.getSharedChatSessions();
      setSharedMemberGroups(response.success && response.data ? response.data : []);
    } catch (error) {
      console.error('Error fetching shared chat groups:', error);
      setSharedMemberGroups([]);
    } finally {
      setIsLoadingShared(false);
    }
  }, [apiConfig, sharedTabEnabled]);

  const loadHistoryFromApi = useCallback(async () => {
    const config = apiConfigRef.current;
    if (!config?.baseUrl || isFetchingHistoryRef.current) return;

    isFetchingHistoryRef.current = true;
    setIsLoadingHistory(true);
    try {
      const backendService = new BackendService(config.baseUrl, config.headers);
      const response = await backendService.getChatSessions();

      // A failed reload keeps the list the user already sees (UAT1-FB-011).
      if (response.success && response.data) {
        const sessions = response.data;
        sessions.forEach(chatSession => {
          addHistoryItemChatSessionRef.current?.(chatSession);
        });

        const savedSessionIds = new Set(sessions.map(session => session.chatSessionId));
        // A chat whose first reply has not arrived is not saved yet. Keep its
        // row until the server lists it.
        const keepUnsaved = (items: HistoryItem[]) =>
          items.filter(
            item =>
              item.id.startsWith('pending-') &&
              !savedSessionIds.has(item.session?.chatSessionId),
          );
        const sortedItems = mapSessionsToHistoryItems(sessions);
        setAllHistoryItems(prev => [...keepUnsaved(prev), ...sortedItems]);
        setHistoryItems(prev => [...keepUnsaved(prev), ...sortedItems.slice(0, PAGE_SIZE)]);
        setHasMoreHistory(sortedItems.length > PAGE_SIZE);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
    } finally {
      isFetchingHistoryRef.current = false;
      setIsLoadingHistory(false);
      setHasLoadedHistoryOnce(true);
    }
  }, [mapSessionsToHistoryItems]);

  const fetchHistory = useCallback(() => loadHistoryFromApi(), [loadHistoryFromApi]);

  useEffect(() => {
    setPage(1);
    void loadHistoryFromApi();
  }, [apiBaseUrl, isArabicLanguage, loadHistoryFromApi]);

  useEffect(() => {
    if (enhancedHistoryEnabled) return;
    setHistoryItems(allHistoryItems.slice(0, page * PAGE_SIZE));
    setHasMoreHistory(page * PAGE_SIZE < allHistoryItems.length);
  }, [page, allHistoryItems, enhancedHistoryEnabled]);

  useEffect(() => {
    if (sharedTabEnabled) {
      fetchSharedGroups();
    }
  }, [sharedTabEnabled, fetchSharedGroups]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        (target.closest('.sidebar-history-toolbar') ||
          target.closest('.sidebar-item-menu'))
      ) {
        return;
      }
      setOpenMenuId(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openMenuId]);

  const timelineLabel = useCallback(
    (key: TimelineGroupKey): string => {
      const labels: Record<TimelineGroupKey, string> = {
        today: t('Today'),
        yesterday: t('Yesterday'),
        lastWeek: t('LastWeek'),
        lastMonth: t('LastMonth'),
        older: t('Older'),
      };
      return labels[key];
    },
    [t],
  );

  const enrichedItems = useMemo((): EnrichedHistoryItem[] => {
    return sourceHistoryItems.map(item => ({
      ...item,
      title: getCustomTitle(historyMeta, item.id) ?? item.title,
      isPinned: historyPinEnabled ? isPinned(historyMeta, item.id) : false,
    }));
  }, [sourceHistoryItems, historyMeta, historyPinEnabled]);

  const filteredItems = useMemo(() => {
    const searched = historySearchEnabled
      ? filterHistoryItems(enrichedItems, searchQuery)
      : enrichedItems;

    if (!historyFilterChipsEnabled || historyFilter === 'all') return searched;
    if (historyFilter === 'pinned') return searched.filter(item => item.isPinned);
    return searched;
  }, [
    enrichedItems,
    searchQuery,
    historyFilter,
    historySearchEnabled,
    historyFilterChipsEnabled,
  ]);

  const pinnedItems = useMemo(
    () =>
      historyPinEnabled
        ? sortHistoryItems(filteredItems.filter(item => item.isPinned))
        : [],
    [filteredItems, historyPinEnabled],
  );

  const unpinnedItems = useMemo(
    () =>
      sortHistoryItems(
        filteredItems.filter(item => !historyPinEnabled || !item.isPinned),
      ),
    [filteredItems, historyPinEnabled],
  );

  const isSearching = historySearchEnabled && searchQuery.trim().length > 0;
  const visibleUnpinnedCount = Math.max(0, page * PAGE_SIZE - pinnedItems.length);
  const visibleUnpinned = unpinnedItems.slice(0, visibleUnpinnedCount);
  const timelineGroups = useMemo(
    () => groupHistoryByTimeline(visibleUnpinned),
    [visibleUnpinned],
  );
  const searchResults = useMemo(
    () => sortHistoryItems(filteredItems).slice(0, page * PAGE_SIZE),
    [filteredItems, page],
  );
  const totalFilteredCount = filteredItems.length;
  const hasMoreVisible = enhancedHistoryEnabled
    ? isSearching
      ? searchResults.length < totalFilteredCount
      : pinnedItems.length + visibleUnpinned.length < totalFilteredCount
    : hasMoreHistory;

  const sharedTabCount = useMemo(
    () =>
      sharedMemberGroups.reduce(
        (sum, group) => sum + group.conversations.length,
        0,
      ),
    [sharedMemberGroups],
  );

  const filteredSharedMemberGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sharedMemberGroups
      .map(group => {
        const conversations = group.conversations.filter(conversation => {
          if (conversation.direction.toLowerCase() !== sharedDirectionFilter) {
            return false;
          }
          if (!q) return true;
          return (
            group.name.toLowerCase().includes(q) ||
            group.email.toLowerCase().includes(q) ||
            conversation.title.toLowerCase().includes(q) ||
            (conversation.previewMessage ?? '').toLowerCase().includes(q)
          );
        });
        return { ...group, conversations };
      })
      .filter(group => group.conversations.length > 0);
  }, [sharedMemberGroups, searchQuery, sharedDirectionFilter]);

  const handleScroll = useCallback(() => {
    const container = historyContainerRef.current;
    if (!container || isLoadingHistory || !hasMoreVisible) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // Avoid auto-paginating when the list does not overflow the container.
    if (scrollHeight <= clientHeight + 1) return;

    if (scrollHeight - scrollTop <= clientHeight * 1.2) {
      setPage(prev => {
        const maxPage = Math.max(1, Math.ceil(totalFilteredCount / PAGE_SIZE));
        if (prev >= maxPage) return prev;
        return prev + 1;
      });
    }
  }, [historyContainerRef, isLoadingHistory, hasMoreVisible, totalFilteredCount]);

  useEffect(() => {
    const container = historyContainerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll, historyContainerRef]);

  const handleSidebarTabChange = useCallback((tab: SidebarTab) => {
    setSidebarTab(tab);
    setSearchQuery('');
    setPage(1);
    setSelectedChatIds(new Set());
    setSelectionRequested(false);
    setShowBulkDeleteConfirm(false);
    if (tab === 'shared') {
      void fetchSharedGroups();
    }
  }, [fetchSharedGroups]);

  const toggleSharedGroup = useCallback((key: string) => {
    setExpandedSharedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const checkHistoryItemExists = useCallback(
    (id: string): boolean => sourceHistoryItems.some(item => item.id === id),
    [sourceHistoryItems],
  );

  const addHistoryItem = useCallback(
    (newItem: HistoryItem) => {
      if (!checkHistoryItemExists(newItem.id)) {
        setActiveHistoryItemId(newItem.id);
        if (enhancedHistoryEnabled) {
          setAllHistoryItems(prev => [newItem, ...prev]);
          setHistoryItems(prev => [newItem, ...prev]);
        } else {
          setHistoryItems(prev => [newItem, ...prev]);
        }
      }
    },
    [checkHistoryItemExists, enhancedHistoryEnabled],
  );

  const replaceHistoryItem = useCallback(
    (temporaryId: string, newItem: HistoryItem, activate = true) => {
      const replace = (items: HistoryItem[]) => [
        newItem,
        ...items.filter(item => item.id !== temporaryId && item.id !== newItem.id),
      ];

      if (activate) setActiveHistoryItemId(newItem.id);
      setHistoryItems(replace);
      if (enhancedHistoryEnabled) setAllHistoryItems(replace);
    },
    [enhancedHistoryEnabled],
  );

  // A new chat has no row yet, so no row stays highlighted.
  const clearActiveHistoryItem = useCallback(() => setActiveHistoryItemId(null), []);

  const removeHistoryItemsLocally = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      if (historyPinEnabled) {
        setHistoryMeta(prev => ids.reduce((acc, id) => removeHistoryMeta(acc, id), prev));
      }
      setAllHistoryItems(prev => prev.filter(item => !idSet.has(item.id)));
      setHistoryItems(prev => prev.filter(item => !idSet.has(item.id)));
      setSelectedChatIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
      if (activeHistoryItemId && idSet.has(activeHistoryItemId)) {
        setActiveHistoryItemId(null);
        onOpenEditor?.();
      }
    },
    [activeHistoryItemId, historyPinEnabled, onOpenEditor],
  );

  const removeHistoryItemLocally = useCallback(
    (id: string) => removeHistoryItemsLocally([id]),
    [removeHistoryItemsLocally],
  );

  const handleDeleteHistoryItem = useCallback(
    async (id: string) => {
      setIsDeletingItem(true);
      try {
        if (apiConfig) {
          const backendService = new BackendService(apiConfig.baseUrl, apiConfig.headers);
          await backendService.deleteChatSession(parseInt(id, 10));
        }
      } catch (error) {
        console.error('Error deleting chat history item:', error);
      } finally {
        removeHistoryItemLocally(id);
        setDeleteConfirmItem(null);
        setIsDeletingItem(false);
        if (sharedTabEnabled) {
          fetchSharedGroups();
        }
      }
    },
    [apiConfig, fetchSharedGroups, removeHistoryItemLocally, sharedTabEnabled],
  );

  const handleConfirmDeleteAll = useCallback(async () => {
    setIsDeletingAll(true);
    const backendService = new BackendService(apiConfig.baseUrl, apiConfig.headers);
    const response = await backendService.deleteAllChatSessions();
    if (response.success) {
      setAllHistoryItems([]);
      setHistoryItems([]);
      setShowDeleteConfirm(false);
      if (sharedTabEnabled) {
        fetchSharedGroups();
      }
    } else {
      console.error('Failed to delete all chat sessions');
    }
    setIsDeletingAll(false);
  }, [apiConfig, fetchSharedGroups, sharedTabEnabled]);

  const handleHistoryItemClick = useCallback(
    (item: HistoryItem) => {
      setActiveHistoryItemId(item.id);
      onHistoryItemSelect?.(item.session);
    },
    [onHistoryItemSelect],
  );

  const openChatById = useCallback(
    (chatId: string) => {
      const id = String(chatId || '').trim();
      if (!id) {
        if (sharedTabEnabled) handleSidebarTabChange('shared');
        return;
      }

      const match = sourceHistoryItems.find(
        item =>
          item.id === id ||
          String(item.session?.chatSessionId || '') === id ||
          String(item.session?.id || '') === id,
      );

      if (match) {
        const isShared =
          match.session?.isSharedCopy || match.session?.isSentShare || false;
        if (sharedTabEnabled) {
          handleSidebarTabChange(isShared ? 'shared' : 'history');
        }
        handleHistoryItemClick(match);
        return;
      }

      if (sharedTabEnabled) {
        handleSidebarTabChange('shared');
      }
    },
    [sourceHistoryItems, handleHistoryItemClick, handleSidebarTabChange, sharedTabEnabled],
  );

  const handleSaveRename = useCallback(
    (id: string) => {
      setHistoryMeta(prev => setCustomTitle(prev, id, renameValue));
      setRenamingId(null);
      setRenameValue('');
    },
    [renameValue],
  );

  const handleStartRename = useCallback((item: HistoryItem) => {
    setRenamingId(item.id);
    setRenameValue(item.title);
  }, []);

  const handleTogglePin = useCallback(
    (id: string) => {
      if (!historyPinEnabled) return;
      setHistoryMeta(prev => togglePin(prev, id));
    },
    [historyPinEnabled],
  );

  const openSharedConversation = useCallback(
    (conversation: SharedChatConversation) => {
      const chatId = String(conversation.chatSessionId);
      const match =
        sourceHistoryItems.find(item => item.id === chatId) ??
        sourceHistoryItems.find(
          item => item.session?.chatSessionId === conversation.chatSessionGuid,
        );

      if (match) {
        handleHistoryItemClick(match);
        return;
      }

      const direction = conversation.direction.toLowerCase();
      const fallbackSession: ChatSession = {
        id: conversation.chatSessionId,
        chatSessionId: conversation.chatSessionGuid,
        serviceId: 0,
        service: undefined,
        createdDate: conversation.sharedAt,
        message: conversation.previewMessage,
        isSharedCopy: direction === 'received',
        isSentShare: direction === 'sent',
      };

      setActiveHistoryItemId(chatId);
      onHistoryItemSelect?.(fallbackSession);
    },
    [sourceHistoryItems, handleHistoryItemClick, onHistoryItemSelect],
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((filter: HistoryFilter) => {
    setHistoryFilter(filter);
    setPage(1);
  }, []);

  const handleSharedDirectionFilterChange = useCallback(
    (filter: SharedDirectionFilter) => {
      setSharedDirectionFilter(filter);
      setPage(1);
    },
    [],
  );

  // Touch screens have no hover to reveal the row checkboxes, so they start selection explicitly.
  const [selectionRequested, setSelectionRequested] = useState(false);
  const isSelectionMode = selectionRequested || selectedChatIds.size > 0;

  const startChatSelection = useCallback(() => setSelectionRequested(true), []);

  const toggleChatSelection = useCallback((id: string) => {
    setSelectedChatIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearChatSelection = useCallback(() => {
    setSelectedChatIds(new Set());
    setSelectionRequested(false);
    setShowBulkDeleteConfirm(false);
  }, []);

  const selectAllVisibleChats = useCallback(() => {
    const visibleIds = (
      enhancedHistoryEnabled
        ? isSearching
          ? searchResults
          : [...pinnedItems, ...unpinnedItems.slice(0, visibleUnpinnedCount)]
        : historyItems
    ).map(item => item.id);
    setSelectedChatIds(new Set(visibleIds));
  }, [
    enhancedHistoryEnabled,
    isSearching,
    searchResults,
    pinnedItems,
    unpinnedItems,
    visibleUnpinnedCount,
    historyItems,
  ]);

  const handleConfirmDeleteSelected = useCallback(async () => {
    const ids = [...selectedChatIds];
    if (ids.length === 0) return;
    setIsDeletingSelected(true);
    try {
      if (apiConfig) {
        const backendService = new BackendService(apiConfig.baseUrl, apiConfig.headers);
        await Promise.allSettled(
          ids.map(id => backendService.deleteChatSession(parseInt(id, 10))),
        );
      }
    } catch (error) {
      console.error('Error deleting selected chats:', error);
    } finally {
      removeHistoryItemsLocally(ids);
      setShowBulkDeleteConfirm(false);
      setSelectedChatIds(new Set());
      setSelectionRequested(false);
      setIsDeletingSelected(false);
      if (sharedTabEnabled) {
        fetchSharedGroups();
      }
    }
  }, [
    apiConfig,
    fetchSharedGroups,
    removeHistoryItemsLocally,
    selectedChatIds,
    sharedTabEnabled,
  ]);

  useEffect(() => {
    if (!isSelectionMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearChatSelection();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isSelectionMode, clearChatSelection]);

  return {
    features,
    enhancedHistoryEnabled,
    historyItems,
    sourceHistoryItems,
    isLoadingHistory,
    isLoadingShared,
    showDeleteConfirm,
    setShowDeleteConfirm,
    isDeletingAll,
    deleteConfirmItem,
    setDeleteConfirmItem,
    isDeletingItem,
    activeHistoryItemId,
    searchQuery,
    renamingId,
    renameValue,
    setRenameValue,
    shareSessionId,
    setShareSessionId,
    shareServiceId,
    setShareServiceId,
    activeShareServiceId,
    sidebarTab,
    historyFilter,
    sharedDirectionFilter,
    openMenuId,
    setOpenMenuId,
    expandedSharedGroups,
    sharedMemberGroups,
    filteredSharedMemberGroups,
    sharedTabCount,
    pinnedItems,
    timelineGroups,
    searchResults,
    filteredItems,
    isSearching,
    timelineLabel,
    fetchHistory,
    fetchSharedGroups,
    hasLoadedHistoryOnce,
    page,
    addHistoryItem,
    replaceHistoryItem,
    checkHistoryItemExists,
    openChatById,
    clearActiveHistoryItem,
    handleSidebarTabChange,
    toggleSharedGroup,
    handleDeleteHistoryItem,
    handleConfirmDeleteAll,
    handleHistoryItemClick,
    handleSaveRename,
    handleStartRename,
    handleTogglePin,
    openSharedConversation,
    handleSearchChange,
    handleFilterChange,
    handleSharedDirectionFilterChange,
    setRenamingId,
    selectedChatIds,
    isSelectionMode,
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    isDeletingSelected,
    toggleChatSelection,
    startChatSelection,
    clearChatSelection,
    selectAllVisibleChats,
    handleConfirmDeleteSelected,
  };
};

export type SidebarHistoryController = ReturnType<typeof useSidebarHistory>;
