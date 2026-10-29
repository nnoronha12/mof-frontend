import React, { useEffect, useMemo, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { ApiConfig, UserLookupItem } from "../models/startup";
import { BackendService } from "../services/backendService";
import { ThemeColors } from "./WeaveAiChat";

interface ShareChatModalProps {
  isOpen: boolean;
  sessionId: number;
  clientSessionId?: string;
  serviceId?: number;
  apiConfig: ApiConfig;
  themeColors: ThemeColors;
  isArabicLanguage: boolean;
  t: (key: string) => string;
  onClose: () => void;
  onShared: () => void;
  onSessionResolved?: (sessionId: number) => void;
}

export const ShareChatModal: React.FC<ShareChatModalProps> = ({
  isOpen,
  sessionId,
  clientSessionId,
  serviceId,
  apiConfig,
  themeColors,
  isArabicLanguage,
  t,
  onClose,
  onShared,
  onSessionResolved,
}) => {
  const [searchText, setSearchText] = useState("");
  const [users, setUsers] = useState<UserLookupItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchText("");
      setUsers([]);
      setSelectedUserId(null);
      setErrorMessage(null);
      setSuccessMessage(null);
      return;
    }

    const trimmedSearch = searchText.trim();
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setErrorMessage(null);

      try {
        const backendService = new BackendService(
          apiConfig.baseUrl,
          apiConfig.headers
        );
        const response = await backendService.searchUsers(trimmedSearch);
        setUsers(response.success ? response.data ?? [] : []);
      } catch (error) {
        console.error("Error searching users:", error);
        setUsers([]);
        setErrorMessage(t("ShareChatSearchError"));
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [apiConfig, isOpen, searchText, t]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  const resolveSessionId = async (): Promise<number | null> => {
    if (Number.isSafeInteger(sessionId) && sessionId > 0) {
      return sessionId;
    }

    if (!clientSessionId) {
      return null;
    }

    const backendService = new BackendService(apiConfig.baseUrl, apiConfig.headers);

    // The chat workflow saves history after delivering the WebSocket reply.
    // Resolve the UUID to its database id here so Share remains usable during
    // that small handoff window instead of requiring the user to refresh.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const sessions = await backendService.getChatSessions();
      const matchingSession = sessions.data?.find(
        (candidate) => candidate.chatSessionId === clientSessionId
      );
      const resolvedSessionId = Number(matchingSession?.id);

      if (Number.isSafeInteger(resolvedSessionId) && resolvedSessionId > 0) {
        onSessionResolved?.(resolvedSessionId);
        return resolvedSessionId;
      }

      if (attempt < 5) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 500));
      }
    }

    return null;
  };

  const handleShare = async () => {
    if (!selectedUserId) return;

    setIsSharing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const resolvedSessionId = await resolveSessionId();
      if (!resolvedSessionId) {
        setErrorMessage("This chat could not be found in history yet. Please try again in a moment.");
        return;
      }

      const backendService = new BackendService(
        apiConfig.baseUrl,
        apiConfig.headers
      );
      const response = await backendService.shareChatSession(
        resolvedSessionId,
        selectedUserId,
        serviceId
      );

      if (!response.success) {
        setErrorMessage(
          response.errors?.[0]?.errorMessage || t("ShareChatFailed")
        );
        return;
      }

      setSuccessMessage(t("ShareChatSuccess"));
      onShared();
      window.setTimeout(() => {
        onClose();
      }, 900);
    } catch (error) {
      console.error("Error sharing chat session:", error);
      setErrorMessage(t("ShareChatFailed"));
    } finally {
      setIsSharing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("ShareChat")}
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#EAECF0] px-5 py-4">
          <h3 className="text-base font-semibold text-[#101828]">
            {t("ShareChat")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
            aria-label={t("Cancel")}
          >
            <XMarkIcon className="h-5 w-5 text-[#667085]" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-[#667085]">{t("ShareChatDescription")}</p>

          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder={t("ShareChatSearchPlaceholder")}
            className="w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm text-[#101828] focus:outline-none focus:ring-2 focus:ring-[var(--share-input-ring)]"
            style={{ "--share-input-ring": themeColors.primary } as React.CSSProperties}
            aria-label={t("ShareChatSearchPlaceholder")}
          />

          <div className="max-h-56 overflow-y-auto rounded-xl border border-[#EAECF0]">
            {isSearching && (
              <div className="px-4 py-3 text-sm text-[#667085]">
                {t("ShareChatSearching")}
              </div>
            )}

            {!isSearching &&
              users.length === 0 && (
                <div className="px-4 py-3 text-sm text-[#667085]">
                  {t("ShareChatNoUsers")}
                </div>
              )}

            {!isSearching &&
              users.map((user) => {
                const displayName = isArabicLanguage
                  ? user.nameAr || user.name
                  : user.name || user.nameAr;
                const isSelected = selectedUserId === user.id;

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={`flex w-full flex-col items-start border-b border-[#F2F4F7] px-4 py-3 text-left last:border-b-0 ${
                      isSelected ? "bg-[rgba(198,167,93,0.12)]" : "hover:bg-gray-50"
                    }`}
                    aria-pressed={isSelected}
                  >
                    <span className="text-sm font-medium text-[#101828]">
                      {displayName}
                    </span>
                    <span className="text-xs text-[#667085]">{user.email}</span>
                  </button>
                );
              })}
          </div>

          {selectedUser && (
            <div className="rounded-xl bg-[#F9FAFB] px-4 py-3 text-sm text-[#344054]">
              {t("ShareChatSelected")}:{" "}
              {isArabicLanguage
                ? selectedUser.nameAr || selectedUser.name
                : selectedUser.name || selectedUser.nameAr}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMessage}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#EAECF0] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-[#667085] hover:bg-gray-100"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={!selectedUserId || isSharing}
            className="rounded-xl px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: themeColors.primary }}
          >
            {isSharing ? t("ShareChatSharing") : t("ShareChatConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
};
