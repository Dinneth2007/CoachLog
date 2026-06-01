import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getSessions } from '../api/sessions';
import type { SessionSummary } from '../api/sessions';

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function SessionsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['sessions', { page, size: PAGE_SIZE }],
    queryFn: () => getSessions({ page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const sessions = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sessions</h1>
          <p className="text-sm text-slate-500 mt-1">
            {totalElements === 0
              ? 'Your training sessions will appear here.'
              : `${totalElements} session${totalElements === 1 ? '' : 's'} logged`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/sessions/new')}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New session
        </button>
      </header>

      {isLoading ? (
        <SkeletonList />
      ) : isError ? (
        <ErrorState />
      ) : sessions.length === 0 ? (
        <EmptyState onStart={() => navigate('/sessions/new')} />
      ) : (
        <>
          <ul
            className={`divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl transition-opacity ${
              isFetching ? 'opacity-60' : 'opacity-100'
            }`}
          >
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} onOpen={() => navigate(`/sessions/${s.id}`)} />
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
              <span>
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SessionRow({ session, onOpen }: { session: SessionSummary; onOpen: () => void }) {
  return (
    <li
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
    >
      <div className="w-24 shrink-0 text-sm text-slate-500 tabular-nums">{formatDate(session.date)}</div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-slate-900 truncate">{session.title}</h3>
      </div>
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200">
        {session.playerCount} {session.playerCount === 1 ? 'player' : 'players'}
      </span>
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden className="text-slate-400">
        <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </li>
  );
}

function SkeletonList() {
  return (
    <ul className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
          <div className="h-3 bg-slate-200 rounded w-20" />
          <div className="flex-1 h-4 bg-slate-100 rounded w-2/3" />
          <div className="h-5 bg-slate-100 rounded-full w-16" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-medium text-slate-900">No sessions yet</h3>
      <p className="mt-1 text-sm text-slate-500">Log your first session to start tracking observations.</p>
      <button
        type="button"
        onClick={onStart}
        className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
      >
        Log your first session
      </button>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <h3 className="text-base font-medium text-red-900">Could not load sessions</h3>
      <p className="mt-1 text-sm text-red-700">Please try refreshing the page.</p>
    </div>
  );
}
