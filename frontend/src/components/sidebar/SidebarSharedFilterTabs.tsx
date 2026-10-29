import React from 'react';
import { twMerge } from 'tailwind-merge';
import { SharedDirectionFilter } from './types';

interface SidebarSharedFilterTabsProps {
  activeFilter: SharedDirectionFilter;
  isArabic: boolean;
  onFilterChange: (filter: SharedDirectionFilter) => void;
}

export const SidebarSharedFilterTabs: React.FC<SidebarSharedFilterTabsProps> = ({
  activeFilter,
  isArabic,
  onFilterChange,
}) => (
  <div className="flex gap-2 mb-2">
    <button
      type="button"
      onClick={() => onFilterChange('received')}
      className={twMerge('sidebar-filter-chip', activeFilter === 'received' && 'sidebar-filter-chip--active')}
    >
      {isArabic ? 'المشتركة' : 'Shared'}
    </button>
    <button
      type="button"
      onClick={() => onFilterChange('sent')}
      className={twMerge('sidebar-filter-chip', activeFilter === 'sent' && 'sidebar-filter-chip--active')}
    >
      {isArabic ? 'المرسلة' : 'Sent'}
    </button>
  </div>
);
