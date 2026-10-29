import { HistoryItem } from '../models/startup';

export type TimelineGroupKey = 'today' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'older';

export interface TimelineGroup {
  key: TimelineGroupKey;
  items: HistoryItem[];
}

export function getTimelineGroup(timestamp: string): TimelineGroupKey {
  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfLastWeek = new Date(startOfToday);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  const startOfLastMonth = new Date(startOfToday);
  startOfLastMonth.setDate(startOfLastMonth.getDate() - 30);

  if (date >= startOfToday) return 'today';
  if (date >= startOfYesterday) return 'yesterday';
  if (date >= startOfLastWeek) return 'lastWeek';
  if (date >= startOfLastMonth) return 'lastMonth';
  return 'older';
}

const GROUP_ORDER: TimelineGroupKey[] = ['today', 'yesterday', 'lastWeek', 'lastMonth', 'older'];

export function groupHistoryByTimeline(items: HistoryItem[]): TimelineGroup[] {
  const buckets = new Map<TimelineGroupKey, HistoryItem[]>();
  for (const item of items) {
    const key = getTimelineGroup(item.timestamp);
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  return GROUP_ORDER
    .filter(key => (buckets.get(key)?.length ?? 0) > 0)
    .map(key => ({ key, items: buckets.get(key)! }));
}
