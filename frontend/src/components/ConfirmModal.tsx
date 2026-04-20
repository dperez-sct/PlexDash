import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title, message, confirmLabel = 'Confirmar',
  confirmClass = 'bg-red-600 hover:bg-red-700 text-white',
  onConfirm, onCancel,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <ExclamationTriangleIcon className="h-6 w-6 text-amber-400 flex-shrink-0" />
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        <p className="text-gray-300 text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
