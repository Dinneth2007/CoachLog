import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import ObservationStep from '../components/ObservationStep';
import { createSession, setAttendance } from '../api/sessions';
import type { Session } from '../api/sessions';
import { AGE_GROUPS, AGE_GROUP_CHIP_CLASSES, getPlayers } from '../api/players';
import type { AgeGroup, Player } from '../api/players';

type Attendee = { id: number; name: string; ageGroup: AgeGroup };

const TITLE_MAX = 100;
const NOTES_MAX = 500;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewSessionPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [session, setSession] = useState<Session | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link to="/sessions" className="text-sm text-slate-500 hover:text-slate-900">
          ← Sessions
        </Link>
        <StepIndicator step={step} />
        <Link to="/sessions" className="text-sm text-slate-500 hover:text-slate-900">
          Cancel
        </Link>
      </div>

      {step === 1 && (
        <Step1
          onCreated={(s) => {
            setSession(s);
            qc.invalidateQueries({ queryKey: ['sessions'] });
            setStep(2);
          }}
        />
      )}

      {step === 2 && session && (
        <Step2
          sessionId={session.id}
          onAttendanceSet={(players) => {
            setAttendees(players);
            setStep(3);
          }}
        />
      )}

      {step === 3 && session && attendees.length > 0 && (
        <ObservationStep
          sessionId={session.id}
          attendees={attendees}
          onSubmitSuccess={() => navigate(`/sessions/${session.id}`, { replace: true })}
        />
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-medium ${
              step === n
                ? 'bg-slate-900 text-white'
                : step > n
                  ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                  : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
            }`}
          >
            {n}
          </span>
          {n < 3 && <span className={`w-6 h-px ${step > n ? 'bg-emerald-200' : 'bg-slate-200'}`} />}
        </div>
      ))}
    </div>
  );
}

function Step1({ onCreated }: { onCreated: (s: Session) => void }) {
  const [date, setDate] = useState<string>(today());
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [topError, setTopError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: createSession,
    onSuccess: (s) => onCreated(s),
    onError: (err) => {
      setFieldErrors({});
      setTopError(null);
      if (axios.isAxiosError(err)) {
        const details = err.response?.data?.details;
        if (details && typeof details === 'object') {
          setFieldErrors(details as Record<string, string>);
          return;
        }
        if (err.response?.data?.error) {
          setTopError(String(err.response.data.error));
          return;
        }
      }
      setTopError('Could not create session. Please try again.');
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTopError(null);
    setFieldErrors({});
    if (!date) {
      setFieldErrors({ date: 'Date is required' });
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFieldErrors({ title: 'Title is required' });
      return;
    }
    mutation.mutate({
      date,
      title: trimmedTitle,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900">New session</h1>
      <p className="text-sm text-slate-500 mt-1">Step 1 of 3 — when and what.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="session-date" className="block text-sm font-medium text-slate-700 mb-1">
            Date
          </label>
          <input
            id="session-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          {fieldErrors.date && <p className="mt-1 text-xs text-red-600">{fieldErrors.date}</p>}
        </div>
        <div>
          <label htmlFor="session-title" className="block text-sm font-medium text-slate-700 mb-1">
            Title
          </label>
          <input
            id="session-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TITLE_MAX}
            autoFocus
            placeholder="e.g. Tuesday evening nets"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          {fieldErrors.title && <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="session-notes" className="block text-sm font-medium text-slate-700">
              Notes
            </label>
            <span className="text-xs text-slate-400">
              {notes.length}/{NOTES_MAX}
            </span>
          </div>
          <textarea
            id="session-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={NOTES_MAX}
            rows={3}
            placeholder="Anything you want to remember about this session?"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
          />
          {fieldErrors.notes && <p className="mt-1 text-xs text-red-600">{fieldErrors.notes}</p>}
        </div>

        {topError && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {topError}
          </p>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={mutation.isPending || !title.trim() || !date}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
          >
            {mutation.isPending ? 'Creating…' : 'Next →'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Step2({
  sessionId,
  onAttendanceSet,
}: {
  sessionId: number;
  onAttendanceSet: (players: Attendee[]) => void;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [topError, setTopError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['players', { all: true }],
    queryFn: () => getPlayers({ size: 200 }),
  });

  const grouped = useMemo(() => {
    const map = new Map<AgeGroup, Player[]>();
    for (const p of data?.content ?? []) {
      const arr = map.get(p.ageGroup) ?? [];
      arr.push(p);
      map.set(p.ageGroup, arr);
    }
    for (const [, arr] of map) arr.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [data]);

  const allPlayers = data?.content ?? [];
  const allSelected = allPlayers.length > 0 && allPlayers.every((p) => selected.has(p.id));

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleMaster = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allPlayers.map((p) => p.id)));
  };

  const toggleGroup = (group: AgeGroup) => {
    const ids = (grouped.get(group) ?? []).map((p) => p.id);
    const allInGroupSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allInGroupSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: (ids: number[]) => setAttendance(sessionId, ids),
    onSuccess: (res) => onAttendanceSet(res.players),
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        setTopError(String(err.response.data.error));
      } else {
        setTopError('Could not save attendance. Please try again.');
      }
      qc.invalidateQueries({ queryKey: ['players'] });
      setSelected(new Set());
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-white border border-slate-200 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <h3 className="text-base font-medium text-red-900">Could not load players</h3>
        <p className="mt-1 text-sm text-red-700">Please try refreshing the page.</p>
      </div>
    );
  }

  if (allPlayers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <h3 className="text-base font-medium text-slate-900">No players in your squad yet</h3>
        <p className="mt-1 text-sm text-slate-500">Add at least one player to log a session.</p>
        <Link
          to="/players"
          className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Add a player
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Attendance</h1>
      <p className="text-sm text-slate-500 mt-1">
        Step 2 of 3 — who came to this session? ({selected.size} selected)
      </p>

      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={toggleMaster}
          className="text-sm font-medium text-slate-700 hover:text-slate-900 underline underline-offset-4"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>

      <div className="mt-4 space-y-5">
        {AGE_GROUPS.filter((g) => grouped.has(g)).map((g) => {
          const players = grouped.get(g) ?? [];
          const ids = players.map((p) => p.id);
          const allInGroupSelected = ids.every((id) => selected.has(id));
          return (
            <div key={g} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${AGE_GROUP_CHIP_CLASSES[g]}`}
                >
                  {g}
                </span>
                <button
                  type="button"
                  onClick={() => toggleGroup(g)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  {allInGroupSelected ? 'Deselect group' : 'Select group'}
                </button>
              </div>
              <ul className="divide-y divide-slate-50">
                {players.map((p) => {
                  const checked = selected.has(p.id);
                  return (
                    <li key={p.id}>
                      <label className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(p.id)}
                          className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <span className="text-sm text-slate-800">{p.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {topError && (
        <p role="alert" className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {topError}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => mutation.mutate([...selected])}
          disabled={selected.size === 0 || mutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
        >
          {mutation.isPending ? 'Saving…' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
