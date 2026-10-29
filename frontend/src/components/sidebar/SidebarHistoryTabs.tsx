import React from 'react';
import { twMerge } from 'tailwind-merge';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { SidebarTab } from './types';

interface SidebarHistoryTabsProps {
  activeTab: SidebarTab;
  sharedTabCount: number;
  isArabic: boolean;
  historyLabel: string;
  sharedLabel: string;
  onTabChange: (tab: SidebarTab) => void;
}

export const SidebarHistoryTabs: React.FC<SidebarHistoryTabsProps> = ({
  activeTab,
  sharedTabCount,
  isArabic,
  historyLabel,
  sharedLabel,
  onTabChange,
}) => (
  <div className="mb-3">
    <div
      className="sidebar-tabs"
      role="tablist"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'history'}
        onClick={() => onTabChange('history')}
        className={twMerge(
          'sidebar-tab',
          activeTab === 'history' && 'sidebar-tab--active',
        )}
      >
        <span className="sidebar-tab-label">{historyLabel}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'shared'}
        onClick={() => onTabChange('shared')}
        className={twMerge(
          'sidebar-tab',
          activeTab === 'shared' && 'sidebar-tab--active sidebar-tab--shared',
        )}
      >
        <span className="sidebar-tab-label">{sharedLabel}</span>
        <LockClosedIcon className="w-3.5 h-3.5 text-[#98A2B3]" />
        {sharedTabCount > 0 && (
          <span
            className={twMerge(
              'sidebar-tab-badge',
              activeTab === 'shared' && 'sidebar-tab-badge--active',
            )}
          >
            {sharedTabCount > 99 ? '99+' : sharedTabCount}
          </span>
        )}
      </button>
    </div>
  </div>
);
