import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  DIFFICULTIES,
  DIFFICULTY_CHIP_CLASSES,
  DIFFICULTY_LABELS,
  getDrills,
} from '../api/drills';
import type { Difficulty, DrillSummary } from '../api/drills';
import {
  CATEGORIES,
  CATEGORY_CHIP_CLASSES,
  CATEGORY_LABELS,
  DIMENSION_LABELS,
} from '../api/sessions';
import type { Category } from '../api/sessions';

const PAGE_SIZE = 12;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  
  return debounced;
}

export default function DrillsPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounced(searchInput.trim(), 300);
  const [skillArea, setSkillArea] = useState<Category | ''>('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [page, setPage] = useState(0);
  const [lastResetKey, setLastResetKey] = useState('');

  const resetKey = `${debouncedSearch}|${skillArea}|${difficulty}`;
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    if (page !== 0) setPage(0);
  }

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['drills', { search: debouncedSearch, skillArea, difficulty, page }],
    queryFn: () =>
      getDrills({
        search: debouncedSearch || undefined,
        skillArea: skillArea || undefined,
        difficulty: difficulty || undefined,
        page,
        size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const drills = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;
  const hasFilters = debouncedSearch.length > 0 || skillArea !== '' || difficulty !== '';

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Drill library</h1>
        <p className="text-sm text-slate-500 mt-1">
          {totalElements === 0 && !hasFilters
            ? 'Loading drills…'
            : `${totalElements} drill${totalElements === 1 ? '' : 's'} available`}
        </p>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <svg
            aria-hidden
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          >
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.75" />
            <path d="M14 14l3.5 3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search drills by name or focus…"
            className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <select
          value={skillArea}
          onChange={(e) => setSkillArea(e.target.value as Category | '')}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="">All skill areas</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty | '')}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="">All difficulties</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABELS[d]}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <SkeletonGrid />
      ) : isError ? (
        <ErrorState />
      ) : drills.length === 0 ? (
        <EmptyFiltered
          onClear={() => {
            setSearchInput('');
            setSkillArea('');
            setDifficulty('');
          }}
        />
      ) : (
        <>
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity ${
              isFetching ? 'opacity-60' : 'opacity-100'
            }`}
          >
            {drills.map((d) => (
              <DrillCard key={d.id} drill={d} onOpen={() => navigate(`/drills/${d.id}`)} />
            ))}
          </div>

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

function DrillCard({ drill, onOpen }: { drill: DrillSummary; onOpen: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="bg-white border border-slate-200 rounded-xl p-5 cursor-pointer transition-all hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-medium text-slate-900 leading-snug">{drill.name}</h3>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${CATEGORY_CHIP_CLASSES[drill.skillArea]}`}
        >
          {CATEGORY_LABELS[drill.skillArea]}
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${DIFFICULTY_CHIP_CLASSES[drill.difficulty]}`}
        >
          {DIFFICULTY_LABELS[drill.difficulty]}
        </span>
        {drill.durationMinutes !== null && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 tabular-nums">
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {drill.durationMinutes} min
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Targets <span className="font-medium text-slate-700">{DIMENSION_LABELS[drill.targetIssue]}</span>
      </p>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
          <div className="h-5 bg-slate-200 rounded w-3/4" />
          <div className="mt-4 flex gap-2">
            <div className="h-5 bg-slate-100 rounded-full w-16" />
            <div className="h-5 bg-slate-100 rounded-full w-20" />
          </div>
          <div className="mt-4 h-3 bg-slate-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function EmptyFiltered({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
      <h3 className="text-base font-medium text-slate-900">No drills match</h3>
      <p className="mt-1 text-sm text-slate-500">Try a different search term or filters.</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 text-sm font-medium text-slate-700 hover:text-slate-900 underline underline-offset-4"
      >
        Clear filters
      </button>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <h3 className="text-base font-medium text-red-900">Could not load drills</h3>
      <p className="mt-1 text-sm text-red-700">Please try refreshing the page.</p>
    </div>
  );
}
