import { HistoryItem } from '../models/startup';
import { getTimelineGroup, TimelineGroupKey } from './chatHistoryTimeline';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1], matrix[i][j - 1], matrix[i - 1][j]) + 1;
    }
  }
  return matrix[b.length][a.length];
}

function fuzzyIncludes(haystack: string, needle: string): boolean {
  if (!needle) return true;
  if (haystack.includes(needle)) return true;
  if (needle.length < 3) return false;
  const words = haystack.split(/\s+/);
  return words.some(word => word.startsWith(needle) || levenshtein(word, needle) <= 1);
}

const DATE_KEYWORDS: Record<string, TimelineGroupKey[]> = {
  today: ['today'],
  yesterday: ['yesterday'],
  week: ['lastWeek'],
  month: ['lastMonth'],
};

function matchesDateKeyword(query: string, timestamp: string): boolean {
  const q = normalize(query);
  for (const [keyword, groups] of Object.entries(DATE_KEYWORDS)) {
    if (q.includes(keyword)) {
      const group = getTimelineGroup(timestamp);
      return groups.includes(group);
    }
  }
  if (q.includes('last week') || q.includes('past week')) {
    return getTimelineGroup(timestamp) === 'lastWeek';
  }
  if (q.includes('last month') || q.includes('past month')) {
    return getTimelineGroup(timestamp) === 'lastMonth';
  }
  return false;
}

export interface EnrichedHistoryItem extends HistoryItem {
  isPinned?: boolean;
}

export function filterHistoryItems(items: EnrichedHistoryItem[], query: string): EnrichedHistoryItem[] {
  const trimmed = query.trim();
  if (!trimmed) return items;

  const tokens = tokenize(trimmed);
  const hasDateKeyword = /today|yesterday|last week|past week|last month|past month|week|month/i.test(trimmed);

  return items.filter(item => {
    const searchable = normalize(`${item.title} ${item.message ?? ''}`);
    if (hasDateKeyword && matchesDateKeyword(trimmed, item.timestamp)) {
      return true;
    }
    return tokens.every(token =>
      fuzzyIncludes(searchable, token) ||
      normalize(item.message ?? '').includes(token),
    );
  });
}

export function sortHistoryItems(items: EnrichedHistoryItem[]): EnrichedHistoryItem[] {
  return [...items].sort((a, b) => {
    const pinDiff = Number(b.isPinned) - Number(a.isPinned);
    if (pinDiff !== 0) return pinDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}
