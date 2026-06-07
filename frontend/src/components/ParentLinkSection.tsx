import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Modal from './Modal';
import {
  generateParentLink,
  getParentLinks,
  revokeParentLink,
} from '../api/parent';
import type { ParentLinkCreated } from '../api/parent';
import { formatDate } from '../utils/format';

export default function ParentLinkSection({ playerId }: { playerId: number }) {
  const qc = useQueryClient();
  const [created, setCreated] = useState<ParentLinkCreated | null>(null);
  const [copied, setCopied] = useState(false);

  const linksQ = useQuery({
    queryKey: ['parentLinks', playerId],
    queryFn: () => getParentLinks(playerId),
  });

  const generate = useMutation({
    mutationFn: () => generateParentLink(playerId),
    onSuccess: (data) => {
      setCopied(false);
      setCreated(data);
      qc.invalidateQueries({ queryKey: ['parentLinks', playerId] });
    },
  });

  const revoke = useMutation({
    mutationFn: (linkId: number) => revokeParentLink(linkId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parentLinks', playerId] }),
  });

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };

  const links = linksQ.data ?? [];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Parent access</h2>
          <p className="mt-0.5 text-xs text-slate-500">Share a read-only progress view via a private link.</p>
        </div>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
        >
          {generate.isPending ? 'Creating…' : 'Share with Parent'}
        </button>
      </div>

      <div className="mt-4">
        {linksQ.isLoading ? (
          <div className="h-10 rounded-lg bg-slate-50 animate-pulse" />
        ) : links.length === 0 ? (
          <p className="text-sm text-slate-400">No active links.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {links.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm text-slate-600">Expires {formatDate(link.expiresAt)}</span>
                <button
                  onClick={() => revoke.mutate(link.id)}
                  disabled={revoke.isPending}
                  className="text-sm font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-1 rounded"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal isOpen={created !== null} onClose={() => setCreated(null)} title="Parent link created">
        {created && (
          <div>
            <p className="text-sm text-slate-600">
              Send this link to {created.playerName}'s parent. It works without a login and expires on{' '}
              {formatDate(created.expiresAt)}.
            </p>
            <div className="mt-4 flex items-stretch gap-2">
              <input
                readOnly
                value={created.url}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <button
                onClick={() => copy(created.url)}
                className="shrink-0 inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
