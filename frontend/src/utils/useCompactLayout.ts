import { useEffect, useState } from 'react';

/** Below Tailwind's `lg` breakpoint (phones and tablets) the sidebar becomes a drawer. */
export const COMPACT_LAYOUT_QUERY = '(max-width: 1023.98px)';

export const isCompactViewport = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(COMPACT_LAYOUT_QUERY).matches
    : false;

export const useCompactLayout = (): boolean => {
  const [isCompact, setIsCompact] = useState(isCompactViewport);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(COMPACT_LAYOUT_QUERY);
    const update = () => setIsCompact(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isCompact;
};
