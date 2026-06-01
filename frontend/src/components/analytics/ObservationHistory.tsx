import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import ScoreDisplay from '../ScoreDisplay';
import { getPlayerObservations } from '../../api/playerProgress';
import type { HistoryScore, ObservationHistoryItem } from '../../api/playerProgress';
import type { ScoreEntry } from '../../api/sessions';
import { formatDate } from '../../utils/format';

interface Props {
  playerId: number;
  pageSize?: number;
}

function toScoreEntries(scores: HistoryScore[]): ScoreEntry[] {
  return scores.map((s) => ({
    category: s.category,
    dimension: s.dimension,
    score: s.score,
    notes: s.notes,
  }));
}

export default function ObservationHistory({ playerId, pageSize = 10 }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['playerObservations', playerId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getPlayerObservations(playerId, pageParam as number, pageSize),
    getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.number + 1),
  });

  const toggle = (observationId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(observationId)) next.delete(observationId);
      else next.add(observationId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Could not load observation history.
      </div>
    );
  }

  const items: ObservationHistoryItem[] = data?.pages.flatMap((p) => p.content) ?? [];
  const totalElements = data?.pages[0]?.totalElements ?? 0;

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic">No observation history yet.</p>
    );
  }

  return (
    <div>
      <p className="text-xs text-slate-500 mb-3">
        Showing {items.length} of {totalElements} observation{totalElements === 1 ? '' : 's'}
      </p>
      <div className="space-y-2">
        {items.map((item) => {
          const isOpen = expanded.has(item.observationId);
          return (
            <div key={item.observationId} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => toggle(item.observationId)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none text-left"
                aria-expanded={isOpen}
              >
                <span className="text-sm text-slate-500 tabular-nums w-24 shrink-0">{formatDate(item.sessionDate)}</span>
                <span className="flex-1 text-sm font-medium text-slate-900 truncate">{item.sessionTitle}</span>
                <span className="text-xs text-slate-400 tabular-nums">{item.scores.length} score{item.scores.length === 1 ? '' : 's'}</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden
                  className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                >
                  <path d="M5 7l5 6 5-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {isOpen && (
                <div className="border-t border-slate-100 px-4 py-4 bg-slate-50/30">
                  <ScoreDisplay scores={toScoreEntries(item.scores)} overallNotes={item.overallNotes} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-4 py-2 text-sm font-medium text-slate-700 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
