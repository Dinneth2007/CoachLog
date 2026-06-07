import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../api/dashboard';
import type { AttentionPlayer } from '../api/dashboard';
import { AGE_GROUP_CHIP_CLASSES } from '../api/players';
import { CATEGORY_CHIP_CLASSES, CATEGORY_LABELS, DIMENSION_LABELS } from '../api/sessions';
import { formatDate } from '../utils/format';
import StatCard from '../components/StatCard';

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M13 7a3 3 0 11-6 0 3 3 0 016 0zM3 16a5 5 0 0110 0M14 9a3 3 0 012 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="3" y="4.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 8h14M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendArrow({ trend }: { trend: AttentionPlayer['trend'] }) {
  if (trend === 'DECLINING') {
    return (
      <span className="inline-flex items-center text-rose-600" title="Declining">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M10 4v12M4 10l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (trend === 'IMPROVING') {
    return (
      <span className="inline-flex items-center text-emerald-600" title="Improving">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M10 16V4M4 10l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-slate-400" title="Stable">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function issueText(p: AttentionPlayer): string {
  const descriptor = p.trend === 'DECLINING' ? 'declining' : 'consistently low';
  return `${CATEGORY_LABELS[p.category]} ${DIMENSION_LABELS[p.dimension]} ${descriptor} — avg ${p.avgScore.toFixed(1)}`;
}

function daysColour(days: number | null): string {
  if (days === null) return 'text-slate-900';
  if (days <= 3) return 'text-emerald-600';
  if (days <= 7) return 'text-amber-600';
  return 'text-rose-600';
}

export default function DashboardPage() {
  const dashQ = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });

  if (dashQ.isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-8 bg-slate-200 rounded w-1/3 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-white border border-slate-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (dashQ.isError || !dashQ.data) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <h3 className="text-base font-medium text-slate-900">Could not load your dashboard</h3>
          <p className="mt-1 text-sm text-slate-500">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  const { coachName, stats, recentSessions, playersNeedingAttention } = dashQ.data;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const stale = stats.daysSinceLastSession !== null && stats.daysSinceLastSession > 7;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Welcome back, {coachName}</h1>
        <p className="mt-1 text-sm text-slate-500">{today}</p>
        {stale && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
            <ClockIcon />
            It's been {stats.daysSinceLastSession} days since your last session.
          </p>
        )}
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<UsersIcon />} label="Total players" value={String(stats.totalPlayers)} to="/players" />
        <StatCard icon={<CalendarIcon />} label="Total sessions" value={String(stats.totalSessions)} to="/sessions" />
        <StatCard icon={<CalendarIcon />} label="This month" value={String(stats.sessionsThisMonth)} to="/sessions" />
        <StatCard
          icon={<ClockIcon />}
          label="Days since last session"
          value={stats.daysSinceLastSession === null ? '—' : String(stats.daysSinceLastSession)}
          valueClass={daysColour(stats.daysSinceLastSession)}
          to="/sessions"
        />
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Players needing attention</h2>
        {playersNeedingAttention.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <div className="inline-flex items-center gap-2 text-emerald-700">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M5 10.5l3.5 3.5L15 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm font-medium">All players tracking well</span>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {playersNeedingAttention.map((p) => (
              <li key={p.playerId}>
                <Link
                  to={`/players/${p.playerId}`}
                  className="block rounded-xl border border-slate-200 p-4 transition-all hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">{p.playerName}</span>
                        <span
                          className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${AGE_GROUP_CHIP_CLASSES[p.ageGroup]}`}
                        >
                          {p.ageGroup}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-600">{issueText(p)}</p>
                      <span
                        className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${CATEGORY_CHIP_CLASSES[p.category]}`}
                      >
                        {CATEGORY_LABELS[p.category]}
                      </span>
                    </div>
                    <TrendArrow trend={p.trend} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Recent sessions</h2>
          {recentSessions.length > 0 && (
            <Link to="/sessions" className="text-sm text-slate-500 hover:text-slate-900">
              View all sessions
            </Link>
          )}
        </div>
        {recentSessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm text-slate-600">No sessions yet — start your first one.</p>
            <Link
              to="/sessions/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
            >
              Start a session
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentSessions.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/sessions/${s.id}`}
                  className="flex items-center justify-between gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{s.title}</p>
                    <p className="text-xs text-slate-500">{formatDate(s.date)}</p>
                  </div>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 tabular-nums">
                    {s.playerCount} {s.playerCount === 1 ? 'player' : 'players'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          to="/sessions/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
        >
          Start New Session
        </Link>
        <Link
          to="/drills"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
        >
          View Drill Library
        </Link>
        <Link
          to="/players"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
        >
          View All Players
        </Link>
      </section>
    </div>
  );
}
