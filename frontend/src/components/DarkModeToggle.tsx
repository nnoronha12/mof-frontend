import React from 'react';
import { twMerge } from 'tailwind-merge';

interface DarkModeToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  className?: string;
  themeColors?: { primary: string };
}

/** Temporary dark-mode switch for local/demo use. */
export const DarkModeToggle: React.FC<DarkModeToggleProps> = ({
  enabled,
  onChange,
  className,
  themeColors = { primary: '#C6A75D' },
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Dark mode"
      onClick={() => onChange(!enabled)}
      className={twMerge(
        'inline-flex items-center gap-2 rounded-full border border-[#EAECF0] bg-white px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-colors',
        className,
      )}
    >
      <span className={twMerge('text-[#667085]', enabled && 'text-[#344054]')}>
        {enabled ? 'Dark' : 'Light'}
      </span>
      <span
        className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: enabled ? themeColors.primary : '#D0D5DD' }}
      >
        <span
          className={twMerge(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
};
