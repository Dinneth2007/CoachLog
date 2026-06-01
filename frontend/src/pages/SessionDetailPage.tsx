import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import ConfirmDialog from '../components/ConfirmDialog';
import ScoreDisplay from '../components/ScoreDisplay';
import { deleteSession, getSession } from '../api/sessions';
import type { SessionDetail } from '../api/sessions';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const idNum = Number(params.id);
  const isValidId = Number.isFinite(idNum) && idNum > 0 && /^\d+$/.test(params.id ?? '');

  const { data, isLoading, error } = useQuery<SessionDetail>({
    queryKey: ['sessions', idNum],
    queryFn: () => getSession(idNum),
    enabled: isValidId,
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteSession(idNum),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      navigate('/sessions', { replace: true });
    },
  });

  useEffect(() => {
    if (!isValidId) navigate('/sessions', { replace: true });
  }, [isValidId, navigate]);

  if (!isValidId) return <Navigate to="/sessions" replace />;

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="h-7 bg-slate-200 rounded w-1/3 animate-pulse" />
        <div className="mt-3 h-4 bg-slate-100 rounded w-1/4 animate-pulse" />
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="mt-3 h-3 bg-slate-100 rounded w-2/3" />
              <div className="mt-2 h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const is404 = axios.isAxiosError(error) && error.response?.status === 404;
    return (
      <div className="max-w-5xl mx-auto">
        <Link to="/sessions" className="text-sm text-slate-500 hover:text-slate-900">
          ← Sessions
        </Link>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <h3 className="text-base font-medium text-slate-900">
            {is404 ? 'Session not found' : 'Could not load this session'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {is404 ? 'It may have been deleted.' : 'Please try refreshing the page.'}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-5xl mx-auto">
      <Link to="/sessions" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900">
        ← Sessions
      </Link>

      <header className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{data.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{formatDate(data.date)}</p>
          {data.notes && (
            <p className="mt-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-w-2xl">
              {data.notes}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-1"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M6 4h8M4 7h12M7 7v8m6-8v8M5 7l1 10h8l1-10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Delete
        </button>
      </header>

      <section className="mt-8">
        {data.players.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <h3 className="text-base font-medium text-slate-900">No attendees on this session</h3>
            <p className="mt-1 text-sm text-slate-500">No players were marked as attending.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.players.map((p) => (
              <div key={p.playerId} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="font-medium text-slate-900 truncate">{p.playerName}</h3>
                </div>
                <ScoreDisplay scores={p.scores} overallNotes={p.overallNotes} />
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete session"
        message={`Delete "${data.title}" and all its observations? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
