import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const confirmClass = destructive
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600'
    : 'bg-slate-900 hover:bg-slate-800 focus:ring-slate-900';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-slate-700 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-1 ${confirmClass}`}
        >
          {isLoading ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
