import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PlayerFormModal from '../components/PlayerFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { AGE_GROUPS, AGE_GROUP_CHIP_CLASSES, deletePlayer, getPlayers } from '../api/players';
import type { AgeGroup, Player } from '../api/players';

const PAGE_SIZE = 20;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function PlayersPage() {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounced(searchInput.trim(), 300);
  const [ageFilter, setAgeFilter] = useState<AgeGroup | ''>('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, ageFilter]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [deleting, setDeleting] = useState<Player | null>(null);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['players', { search: debouncedSearch, ageGroup: ageFilter, page }],
    queryFn: () =>
      getPlayers({
        search: debouncedSearch || undefined,
        ageGroup: ageFilter || undefined,
        page,
        size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePlayer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['players'] });
      setDeleting(null);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (p: Player) => {
    setEditing(p);
    setFormOpen(true);
  };

  const hasFilters = debouncedSearch.length > 0 || ageFilter !== '';
  const players = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Players</h1>
        <p className="text-sm text-slate-500 mt-1">
          {totalElements === 0
            ? 'Your squad will appear here once you add players.'
            : `${totalElements} player${totalElements === 1 ? '' : 's'} in your squad`}
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
            placeholder="Search by name…"
            className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <select
          value={ageFilter}
          onChange={(e) => setAgeFilter(e.target.value as AgeGroup | '')}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="">All age groups</option>
          {AGE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <div className="sm:ml-auto">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add player
          </button>
        </div>
      </div>

      {isLoading ? (
        <SkeletonGrid />
      ) : isError ? (
        <ErrorState />
      ) : players.length === 0 ? (
        hasFilters ? (
          <EmptyFiltered
            onClear={() => {
              setSearchInput('');
              setAgeFilter('');
            }}
          />
        ) : (
          <EmptyState onAdd={openCreate} />
        )
      ) : (
        <>
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity ${
              isFetching ? 'opacity-60' : 'opacity-100'
            }`}
          >
            {players.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                onEdit={() => openEdit(p)}
                onDelete={() => setDeleting(p)}
              />
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

      <PlayerFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} player={editing} />

      <ConfirmDialog
        isOpen={!!deleting}
        title="Remove player"
        message={
          deleting
            ? `Are you sure you want to remove ${deleting.name}? This cannot be undone.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function PlayerCard({
  player,
  onEdit,
  onDelete,
}: {
  player: Player;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit();
        }
      }}
      className="group relative bg-white border border-slate-200 rounded-xl p-5 text-left cursor-pointer transition-all hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`Remove ${player.name}`}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-red-600 rounded-md p-1 transition-opacity focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-1"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M6 4h8M4 7h12M7 7v8m6-8v8M5 7l1 10h8l1-10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className="pr-6">
        <h3 className="font-medium text-slate-900 truncate">{player.name}</h3>
      </div>
      <span
        className={`inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${AGE_GROUP_CHIP_CLASSES[player.ageGroup]}`}
      >
        {player.ageGroup}
      </span>
      {player.notes ? (
        <p className="mt-3 text-sm text-slate-600 line-clamp-2 leading-relaxed">{player.notes}</p>
      ) : (
        <p className="mt-3 text-sm text-slate-400 italic">No notes yet</p>
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-2/3" />
          <div className="h-5 bg-slate-100 rounded-full w-12 mt-3" />
          <div className="h-3 bg-slate-100 rounded w-full mt-4" />
          <div className="h-3 bg-slate-100 rounded w-4/5 mt-2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-medium text-slate-900">No players yet</h3>
      <p className="mt-1 text-sm text-slate-500">Add your first player to start logging sessions.</p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
      >
        Add your first player
      </button>
    </div>
  );
}

function EmptyFiltered({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
      <h3 className="text-base font-medium text-slate-900">No matches</h3>
      <p className="mt-1 text-sm text-slate-500">Try a different search term or age group.</p>
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
      <h3 className="text-base font-medium text-red-900">Could not load players</h3>
      <p className="mt-1 text-sm text-red-700">Please try refreshing the page.</p>
    </div>
  );
}
