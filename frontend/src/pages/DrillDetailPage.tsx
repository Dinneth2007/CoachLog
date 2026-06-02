import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  DIFFICULTY_CHIP_CLASSES,
  DIFFICULTY_LABELS,
  getDrill,
} from '../api/drills';
import {
  CATEGORY_CHIP_CLASSES,
  CATEGORY_LABELS,
  DIMENSION_LABELS,
} from '../api/sessions';

function ageRangeLabel(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) return `Ages ${min}–${max}`;
  if (min !== null) return `Ages ${min}+`;
  return `Up to age ${max}`;
}

export default function DrillDetailPage() {
  const params = useParams<{ id: string }>();
  const idNum = Number(params.id);
  const isValidId = Number.isFinite(idNum) && idNum > 0 && /^\d+$/.test(params.id ?? '');

  const { data, isLoading, error } = useQuery({
    queryKey: ['drill', idNum],
    queryFn: () => getDrill(idNum),
    enabled: isValidId,
  });

  if (!isValidId) return <Navigate to="/drills" replace />;

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="h-4 bg-slate-200 rounded w-24 animate-pulse" />
        <div className="mt-4 h-8 bg-slate-200 rounded w-2/3 animate-pulse" />
        <div className="mt-4 flex gap-2">
          <div className="h-6 bg-slate-100 rounded-full w-20" />
          <div className="h-6 bg-slate-100 rounded-full w-24" />
        </div>
        <div className="mt-6 space-y-2">
          <div className="h-3 bg-slate-100 rounded w-full" />
          <div className="h-3 bg-slate-100 rounded w-5/6" />
          <div className="h-3 bg-slate-100 rounded w-4/6" />
        </div>
      </div>
    );
  }

  if (error) {
    const is404 = axios.isAxiosError(error) && error.response?.status === 404;
    return (
      <div className="max-w-3xl mx-auto">
        <Link to="/drills" className="text-sm text-slate-500 hover:text-slate-900">
          ← Drill library
        </Link>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <h3 className="text-base font-medium text-slate-900">
            {is404 ? 'Drill not found' : 'Could not load this drill'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {is404 ? 'It may have been removed.' : 'Please try refreshing the page.'}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const ageLabel = ageRangeLabel(data.ageMin, data.ageMax);

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/drills" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900">
        ← Drill library
      </Link>

      <header className="mt-3">
        <h1 className="text-3xl font-semibold text-slate-900">{data.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${CATEGORY_CHIP_CLASSES[data.skillArea]}`}
          >
            {CATEGORY_LABELS[data.skillArea]}
          </span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${DIFFICULTY_CHIP_CLASSES[data.difficulty]}`}
          >
            {DIFFICULTY_LABELS[data.difficulty]}
          </span>
          {data.durationMinutes !== null && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 tabular-nums">
              <svg width="11" height="11" viewBox="0 0 20 20" fill="none" aria-hidden>
                <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {data.durationMinutes} min
            </span>
          )}
          {ageLabel && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 tabular-nums">
              {ageLabel}
            </span>
          )}
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Targets <span className="font-medium text-slate-700">{DIMENSION_LABELS[data.targetIssue]}</span>
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">How to run it</h2>
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{data.description}</p>
      </section>

      {data.equipment.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Equipment</h2>
          <div className="flex flex-wrap gap-1.5">
            {data.equipment.map((item) => (
              <span
                key={item}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200"
              >
                {item}
              </span>
            ))}
          </div>
        </section>
      )}

      {data.variations && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Variations</h2>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{data.variations}</p>
        </section>
      )}

      {data.videoUrl && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Video</h2>
          <a
            href={data.videoUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-800 underline underline-offset-4"
          >
            Watch on the source site
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M7 4h9v9M16 4L8 12M4 8v8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </section>
      )}
    </div>
  );
}
