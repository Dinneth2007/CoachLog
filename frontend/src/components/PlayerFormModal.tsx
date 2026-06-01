import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Modal from './Modal';
import { AGE_GROUPS, createPlayer, updatePlayer } from '../api/players';
import type { AgeGroup, CreatePlayerData, Player } from '../api/players';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  player?: Player | null;
}

const NAME_MAX = 100;
const NOTES_MAX = 500;

export default function PlayerFormModal({ isOpen, onClose, player }: Props) {
  const isEdit = !!player;
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('U13');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(player?.name ?? '');
      setAgeGroup(player?.ageGroup ?? 'U13');
      setNotes(player?.notes ?? '');
      setError(null);
    }
  }, [isOpen, player]);

  const mutation = useMutation({
    mutationFn: (data: CreatePlayerData) =>
      isEdit && player ? updatePlayer(player.id, data) : createPlayer(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['players'] });
      onClose();
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const details = err.response?.data?.details;
        if (details && typeof details === 'object') {
          const firstField = Object.keys(details)[0];
          setError(`${firstField}: ${details[firstField]}`);
          return;
        }
        if (err.response?.data?.error) {
          setError(err.response.data.error);
          return;
        }
      }
      setError('Could not save player. Please try again.');
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }
    if (trimmedName.length > NAME_MAX) {
      setError(`Name must be ${NAME_MAX} characters or fewer`);
      return;
    }
    if (notes.length > NOTES_MAX) {
      setError(`Notes must be ${NOTES_MAX} characters or fewer`);
      return;
    }
    mutation.mutate({
      name: trimmedName,
      ageGroup,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit player' : 'Add player'}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="player-name" className="block text-sm font-medium text-slate-700 mb-1">
            Name
          </label>
          <input
            id="player-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            autoFocus
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div>
          <label htmlFor="player-age" className="block text-sm font-medium text-slate-700 mb-1">
            Age group
          </label>
          <select
            id="player-age"
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {AGE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="player-notes" className="block text-sm font-medium text-slate-700">
              Notes
            </label>
            <span className="text-xs text-slate-400">{notes.length}/{NOTES_MAX}</span>
          </div>
          <textarea
            id="player-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={NOTES_MAX}
            rows={3}
            placeholder="Strengths, weaknesses, personality…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-medium text-slate-700 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
          >
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add player'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
