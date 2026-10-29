import React, { useId } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ThemeColors } from '../WeaveAiChat';

interface SidebarHistorySearchProps {
  value: string;
  placeholder: string;
  isArabic: boolean;
  themeColors?: ThemeColors;
  onChange: (value: string) => void;
}

export const SidebarHistorySearch: React.FC<SidebarHistorySearchProps> = ({
  value,
  placeholder,
  isArabic,
  themeColors,
  onChange,
}) => {
  const inputId = useId();
  const hasValue = value.trim().length > 0;

  return (
    <div
      className="mof-search-field"
      style={
        {
          '--sidebar-search-focus': themeColors?.primary,
        } as React.CSSProperties
      }
    >
      <label htmlFor={inputId} className="sr-only">
        {placeholder}
      </label>
      <MagnifyingGlassIcon className="mof-search-field__icon" aria-hidden="true" />
      <input
        id={inputId}
        type="text"
        role="searchbox"
        inputMode="search"
        autoComplete="off"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="mof-search-field__input"
        dir={isArabic ? 'rtl' : 'ltr'}
      />
      {hasValue && (
        <button
          type="button"
          className="mof-search-field__clear"
          onClick={() => onChange('')}
          aria-label={isArabic ? 'مسح البحث' : 'Clear search'}
        >
          <XMarkIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
