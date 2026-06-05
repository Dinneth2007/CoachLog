import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CATEGORY_CHIP_CLASSES, CATEGORY_LABELS } from '../api/sessions';
import {
  generateRecommendations,
  getRecommendations,
} from '../api/recommendations';
import type { DrillRecommendation } from '../api/recommendations';

const COOLDOWN_HOURS = 24;

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden className="text-violet-500">
      <path d="M10 1.5l1.6 4.4 4.4 1.6-4.4 1.6L10 13.5 8.4 9.1 4 7.5l4.4-1.6L10 1.5zM4.5 12.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2L1.5 15.5l2.2-.8.8-2.2z" />
    </svg>
  );
}

function hoursUntilAvailable(generatedAt: string | null): number {
  if (!generatedAt) return 0;
  const remainingMs = COOLDOWN_HOURS * 3_600_000 - (Date.now() - new Date(generatedAt).getTime());
  return remainingMs > 0 ? Math.ceil(remainingMs / 3_600_000) : 0;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function RecommendationCard({ rec }: { rec: DrillRecommendation }) {
  const pct = rec.similarityScore == null ? null : Math.round(Math.max(0, Math.min(1, rec.similarityScore)) * 100);
  return (
    <li className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <Link
          to={`/drills/${rec.drillId}`}
          className="text-sm font-semibold text-slate-900 hover:underline focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 rounded"
        >
          {rec.drillName}
        </Link>
        <span
          className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${CATEGORY_CHIP_CLASSES[rec.skillArea]}`}
        >
          {CATEGORY_LABELS[rec.skillArea]}
        </span>
      </div>

      {pct != null && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-violet-400" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-slate-400 tabular-nums">{pct}% match</span>
        </div>
      )}

      <p className="mt-3 text-sm text-slate-600 leading-relaxed">{rec.rationale}</p>

      <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Expected outcome</p>
        <p className="mt-0.5 text-sm text-slate-700 leading-relaxed">{rec.expectedOutcome}</p>
      </div>
    </li>
  );
}

export default function RecommendationSection({ playerId }: { playerId: number }) {
  const qc = useQueryClient();

  const recQ = useQuery({
    queryKey: ['recommendations', playerId],
    queryFn: () => getRecommendations(playerId),
  });

  const generate = useMutation({
    mutationFn: (force: boolean) => generateRecommendations(playerId, force),
    onSuccess: (data) => {
      qc.setQueryData(['recommendations', playerId], data);
    },
  });

  const recs = recQ.data?.recommendations ?? [];
  const generatedAt = recQ.data?.generatedAt ?? null;
  const hasRecs = recs.length > 0;
  const hoursLeft = hoursUntilAvailable(generatedAt);
  const inCooldown = hasRecs && hoursLeft > 0;
  const busy = generate.isPending;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 inline-flex items-center gap-1.5">
            <SparkleIcon />
            AI-Recommended Drills
          </h2>
          {generatedAt && (
            <p className="mt-0.5 text-xs text-slate-500">Last generated: {formatTimestamp(generatedAt)}</p>
          )}
        </div>

        {hasRecs && (
          <div className="shrink-0 text-right">
            <button
              onClick={() => generate.mutate(false)}
              disabled={busy || inCooldown}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
            >
              {busy ? 'Generating…' : 'Refresh Recommendations'}
            </button>
            {inCooldown && (
              <p className="mt-1 text-xs text-slate-400">
                Generated recently — available again in {hoursLeft} hour{hoursLeft === 1 ? '' : 's'}
              </p>
            )}
          </div>
        )}
      </div>

      {recQ.isLoading || busy ? (
        <ul className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="rounded-xl border border-slate-200 p-4 h-28 animate-pulse bg-slate-50" />
          ))}
        </ul>
      ) : recQ.isError || generate.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center">
          <p className="text-sm text-rose-700">Recommendations unavailable — try again later.</p>
          <button
            onClick={() => {
              generate.reset();
              generate.mutate(false);
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-1"
          >
            Try again
          </button>
        </div>
      ) : !hasRecs ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-600">No recommendations yet — generate your first set.</p>
          <button
            onClick={() => generate.mutate(false)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
          >
            <SparkleIcon />
            Generate Recommendations
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {recs.map((rec) => (
            <RecommendationCard key={rec.drillId} rec={rec} />
          ))}
        </ul>
      )}
    </div>
  );
}
