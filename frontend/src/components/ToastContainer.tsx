import { useToast, Toast } from '../contexts/ToastContext';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

const STYLES = {
  success: { bar: 'bg-green-500', icon: <CheckCircleIcon className="h-5 w-5 text-green-400" />, text: 'text-green-100' },
  error:   { bar: 'bg-red-500',   icon: <XCircleIcon className="h-5 w-5 text-red-400" />,     text: 'text-red-100'   },
  warning: { bar: 'bg-amber-500', icon: <ExclamationTriangleIcon className="h-5 w-5 text-amber-400" />, text: 'text-amber-100' },
  info:    { bar: 'bg-blue-500',  icon: <InformationCircleIcon className="h-5 w-5 text-blue-400" />,   text: 'text-blue-100'  },
};

function ToastItem({ toast }: { toast: Toast }) {
  const { dismiss } = useToast();
  const s = STYLES[toast.type];
  return (
    <div className="flex items-start gap-3 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 min-w-[280px] max-w-sm animate-in slide-in-from-right-5 duration-200">
      <div className={`w-1 self-stretch rounded-full ${s.bar} flex-shrink-0`} />
      <div className="flex-shrink-0 mt-0.5">{s.icon}</div>
      <p className={`flex-1 text-sm font-medium ${s.text}`}>{toast.message}</p>
      <button onClick={() => dismiss(toast.id)} className="flex-shrink-0 text-gray-500 hover:text-white transition-colors mt-0.5">
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useToast();
  if (!toasts.length) return null;
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}
