import React from 'react';
import { twMerge } from 'tailwind-merge';
import { HistoryFilter } from './types';

interface SidebarHistoryFilterChipsProps {
  activeFilter: HistoryFilter;
  isArabic: boolean;
  onFilterChange: (filter: HistoryFilter) => void;
}

const FILTER_ORDER_LTR: HistoryFilter[] = ['all', 'pinned'];
const FILTER_ORDER_RTL: HistoryFilter[] = ['all', 'pinned'];

const FILTER_LABELS: Record<HistoryFilter, { en: string; ar: string }> = {
  all: { en: 'All', ar: 'الكل' },
  pinned: { en: 'Pinned', ar: 'المثبتة' },
};

export const SidebarHistoryFilterChips: React.FC<SidebarHistoryFilterChipsProps> = ({
  activeFilter,
  isArabic,
  onFilterChange,
}) => {
  const filters = isArabic ? FILTER_ORDER_RTL : FILTER_ORDER_LTR;

  return (
    <div
      className={twMerge(
        'flex gap-3 flex-wrap mb-2',
      )}
    >
      {filters.map(filterKey => (
        <button
          key={filterKey}
          type="button"
          onClick={() => onFilterChange(filterKey)}
          className={twMerge(
            'sidebar-filter-chip',
            activeFilter === filterKey && 'sidebar-filter-chip--active',
          )}
        >
          {isArabic
            ? FILTER_LABELS[filterKey].ar
            : FILTER_LABELS[filterKey].en}
        </button>
      ))}
    </div>
  );
};
