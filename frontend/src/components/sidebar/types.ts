import { ChatUiFeatures } from '../../models/startup';

export type SidebarTab = 'history' | 'shared';
export type HistoryFilter = 'all' | 'pinned';
export type SharedDirectionFilter = 'received' | 'sent';

export interface ResolvedSidebarFeatures {
  sharedTabEnabled: boolean;
  historySearchEnabled: boolean;
  historyFilterChipsEnabled: boolean;
  historyPinEnabled: boolean;
  chatShareEnabled: boolean;
  enhancedHistoryEnabled: boolean;
}

export const resolveSidebarFeatures = (
  chatUiFeatures?: ChatUiFeatures,
): ResolvedSidebarFeatures => {
  const features = chatUiFeatures ?? {};
  const sharedTabEnabled = features.sharedTabEnabled ?? true;
  const historySearchEnabled = features.historySearchEnabled ?? true;
  const historyFilterChipsEnabled = features.historyFilterChipsEnabled ?? true;
  const historyPinEnabled = features.historyPinEnabled ?? true;
  const chatShareEnabled = features.chatShareEnabled ?? true;

  return {
    sharedTabEnabled,
    historySearchEnabled,
    historyFilterChipsEnabled,
    historyPinEnabled,
    chatShareEnabled,
    enhancedHistoryEnabled:
      sharedTabEnabled ||
      historySearchEnabled ||
      historyFilterChipsEnabled ||
      historyPinEnabled ||
      chatShareEnabled,
  };
};

export const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase();
