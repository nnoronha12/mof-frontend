import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PresentationChartBarIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  getPresentationDeck,
  listMyPresentationDecks,
  PresentationDeckSummary,
} from '../services/presentationWorkflow';
import { buildCoverSlideHtml } from './presentationPreview';

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

const TEXT = {
  en: {
    title: 'Your presentations',
    show: 'Show your presentations',
    close: 'Hide your presentations',
    count: (count: number) => (count === 1 ? '1 presentation' : `${count} presentations`),
    refresh: 'Refresh',
    loading: 'Loading your presentations…',
    error: 'Your presentations could not be loaded.',
    retry: 'Try again',
    empty: 'Decks you create here will appear in this list.',
    slides: (count: number) => (count === 1 ? '1 slide' : `${count} slides`),
    noPreview: 'No preview',
    open: (title: string) => `Open ${title}`,
    untitled: 'Untitled presentation',
    locale: 'en-GB',
  },
  ar: {
    title: 'عروضك التقديمية',
    show: 'عرض عروضك التقديمية',
    close: 'إخفاء عروضك التقديمية',
    count: (count: number) => (count === 1 ? 'عرض تقديمي واحد' : count === 2 ? 'عرضان تقديميان' : `${count} عروض تقديمية`),
    refresh: 'تحديث',
    loading: 'جارٍ تحميل عروضك التقديمية…',
    error: 'تعذّر تحميل عروضك التقديمية.',
    retry: 'إعادة المحاولة',
    empty: 'ستظهر هنا العروض التقديمية التي تنشئها.',
    slides: (count: number) => (count === 1 ? 'شريحة واحدة' : count === 2 ? 'شريحتان' : `${count} شرائح`),
    noPreview: 'لا تتوفر معاينة',
    open: (title: string) => `فتح ${title}`,
    untitled: 'عرض تقديمي بلا عنوان',
    locale: 'ar-AE',
  },
};

// Covers survive closing and reopening the panel; keyed by deck and revision.
const coverCache = new Map<string, Promise<string | null>>();

const loadCover = (deck: PresentationDeckSummary) => {
  const key = `${deck.deckId}:${deck.revision}`;
  let cover = coverCache.get(key);
  if (!cover) {
    cover = getPresentationDeck(deck.deckId)
      .then((result) => (result.html ? buildCoverSlideHtml(result.html) : null))
      .catch(() => {
        coverCache.delete(key);
        return null;
      });
    coverCache.set(key, cover);
  }
  return cover;
};

const DeckCover: React.FC<{ deck: PresentationDeckSummary; noPreview: string }> = ({ deck, noPreview }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [cover, setCover] = useState<string | null | undefined>(undefined);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => setScale(box.clientWidth / SLIDE_WIDTH);
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(box);
    // Load the deck only once its card scrolls into view.
    const seen = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        seen.disconnect();
      }
    }, { rootMargin: '200px' });
    seen.observe(box);
    return () => {
      resize.disconnect();
      seen.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setCover(undefined);
    loadCover(deck).then((html) => {
      if (!cancelled) setCover(html);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, deck.deckId, deck.revision]);

  return (
    <div ref={boxRef} className="relative w-full overflow-hidden rounded-md border border-[#EAECF0] bg-[#F2F4F7]" style={{ aspectRatio: '16 / 9' }}>
      {cover ? (
        <iframe
          title=""
          aria-hidden="true"
          tabIndex={-1}
          sandbox=""
          srcDoc={cover}
          className="pointer-events-none absolute left-0 top-0 border-0"
          style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        />
      ) : cover === null ? (
        <div className="flex h-full items-center justify-center gap-1.5 text-xs text-[#667085]">
          <PresentationChartBarIcon className="h-4 w-4" />
          {noPreview}
        </div>
      ) : (
        <div className="h-full w-full animate-pulse bg-[#EAECF0]" />
      )}
    </div>
  );
};

interface PresentationHistoryListProps {
  isArabic: boolean;
  accentColor: string;
  activeDeckId?: string | null;
  /** Change it to reload the list, for example after a new deck is shown. */
  refreshKey?: string | number;
  onOpenDeck: (deck: PresentationDeckSummary) => void;
}

/** The user's past decks with cover previews; used in the history panel and the viewer's History tab. */
export const PresentationHistoryList: React.FC<PresentationHistoryListProps> = ({
  isArabic,
  accentColor,
  activeDeckId,
  refreshKey,
  onOpenDeck,
}) => {
  const T = isArabic ? TEXT.ar : TEXT.en;
  const [decks, setDecks] = useState<PresentationDeckSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setFailed(false);
    try {
      const next = await listMyPresentationDecks();
      if (request === requestRef.current) setDecks(next);
    } catch {
      if (request === requestRef.current) setFailed(true);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(T.locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  };

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="flex h-full min-h-0 flex-col bg-[#FCFCFD]">
      <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
        <span className="text-xs text-[#667085]">{decks && decks.length > 0 ? T.count(decks.length) : ''}</span>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md p-1.5 text-[#667085] hover:bg-gray-100 disabled:opacity-50"
          aria-label={T.refresh}
          title={T.refresh}
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {decks === null && loading && (
          <div role="status" aria-live="polite" className="flex flex-col gap-3">
            <span className="sr-only">{T.loading}</span>
            {[0, 1, 2].map((item) => (
              <div key={item} className="animate-pulse">
                <div className="w-full rounded-md bg-[#EAECF0]" style={{ aspectRatio: '16 / 9' }} />
                <div className="mt-2 h-3 w-3/4 rounded bg-[#EAECF0]" />
              </div>
            ))}
          </div>
        )}

        {failed && (
          <div role="alert" className="rounded-md border border-[#FEE4E2] bg-[#FFFBFA] p-3 text-sm text-[#B42318]">
            <p className="m-0">{T.error}</p>
            <button type="button" onClick={() => void load()} className="mt-2 text-sm font-medium underline">
              {T.retry}
            </button>
          </div>
        )}

        {!failed && decks && decks.length === 0 && (
          <p className="m-0 px-1 py-6 text-center text-sm text-[#667085]">{T.empty}</p>
        )}

        {decks && decks.length > 0 && (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-0">
            {decks.map((deck) => {
              const title = deck.title || deck.topic || T.untitled;
              const active = deck.deckId === activeDeckId;
              return (
                <li key={deck.deckId}>
                  <button
                    type="button"
                    onClick={() => onOpenDeck(deck)}
                    aria-label={T.open(title)}
                    aria-current={active ? 'true' : undefined}
                    className="w-full rounded-lg border bg-white p-2 text-start transition-shadow hover:shadow-[0_4px_12px_rgba(198,167,93,0.18)]"
                    style={{ borderColor: active ? accentColor : '#EAECF0' }}
                  >
                    <DeckCover deck={deck} noPreview={T.noPreview} />
                    <span
                      dir="auto"
                      className="mt-2 block truncate text-sm font-medium text-[#101828]"
                      title={title}
                    >
                      {title}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#667085]">
                      {T.slides(deck.slideCount)}
                      {formatDate(deck.updatedAt) && ` · ${formatDate(deck.updatedAt)}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

interface PresentationHistoryPanelProps extends PresentationHistoryListProps {
  isMobile: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Right-hand panel of past decks, shown while no deck is open. Collapsed to a strip until clicked;
 * on phones and tablets it opens full-screen and is hidden while closed.
 */
export const PresentationHistoryPanel: React.FC<PresentationHistoryPanelProps> = ({
  isMobile,
  isOpen,
  onOpenChange,
  ...listProps
}) => {
  const T = listProps.isArabic ? TEXT.ar : TEXT.en;

  if (!isOpen) {
    if (isMobile) return null;
    return (
      <aside className="order-last flex w-12 shrink-0 flex-col items-center border-s border-[#EAECF0] bg-[#FCFCFD] pt-3">
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="flex flex-col items-center gap-2 rounded-lg p-2 text-[#667085] hover:bg-white"
          aria-label={T.show}
          title={T.show}
        >
          <PresentationChartBarIcon className="h-5 w-5" style={{ color: listProps.accentColor }} />
          {listProps.isArabic ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
        </button>
      </aside>
    );
  }

  return (
    <aside
      dir={listProps.isArabic ? 'rtl' : 'ltr'}
      aria-label={T.title}
      className={
        isMobile
          ? 'fixed inset-0 z-50 flex flex-col bg-white'
          : 'order-last flex h-full w-[320px] shrink-0 flex-col border-s border-[#EAECF0] bg-[#FCFCFD] shadow-[-8px_0_24px_rgba(16,24,40,0.06)]'
      }
    >
      <div className="flex h-14 items-center justify-between gap-2 border-b border-[#EAECF0] bg-white px-4">
        <h2 className="m-0 flex items-center gap-2 text-sm font-semibold text-[#101828]">
          <PresentationChartBarIcon className="h-5 w-5" style={{ color: listProps.accentColor }} />
          {T.title}
        </h2>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-md p-1.5 text-[#667085] hover:bg-gray-100"
          aria-label={T.close}
          title={T.close}
        >
          {isMobile ? (
            <XMarkIcon className="h-5 w-5" />
          ) : listProps.isArabic ? (
            <ChevronLeftIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          )}
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <PresentationHistoryList {...listProps} />
      </div>
    </aside>
  );
};

export default PresentationHistoryPanel;
