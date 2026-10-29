import React from 'react';
import { twMerge } from 'tailwind-merge';

interface LanguageToggleProps {
  isArabic: boolean;
  onChange: (isArabic: boolean) => void;
  className?: string;
  themeColors?: { primary: string };
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  isArabic,
  onChange,
  className,
  themeColors = { primary: '#C6A75D' },
}) => {
  return (
    <div
      className={twMerge(
        'inline-flex items-center rounded-full border border-[#EAECF0] bg-white p-0.5 shadow-sm',
        className,
      )}
      role="group"
      aria-label={isArabic ? 'لغة الواجهة' : 'Interface language'}
    >
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-label={isArabic ? 'تبديل الواجهة إلى الإنجليزية' : 'Switch interface to English'}
        aria-pressed={!isArabic}
        lang="en"
        className={twMerge(
          'px-3 py-1.5 text-xs font-semibold rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#80652E]',
          !isArabic ? 'text-white' : 'text-[#667085] hover:text-[#344054]',
        )}
        style={!isArabic ? { backgroundColor: themeColors.primary } : undefined}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-label={isArabic ? 'تبديل الواجهة إلى العربية' : 'Switch interface to Arabic'}
        aria-pressed={isArabic}
        lang="ar"
        className={twMerge(
          'px-3 py-1.5 text-xs font-semibold rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#80652E]',
          isArabic ? 'text-white' : 'text-[#667085] hover:text-[#344054]',
        )}
        style={isArabic ? { backgroundColor: themeColors.primary } : undefined}
      >
        AR
      </button>
    </div>
  );
};
