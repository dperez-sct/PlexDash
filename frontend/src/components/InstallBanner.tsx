import { useEffect, useState } from 'react';
import { ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('pwa-install-dismissed') === '1';
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!prompt || dismissed) return null;

  const handleInstall = async () => {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', '1');
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-plex-dark border border-plex-yellow/40 rounded-xl p-4 shadow-2xl flex items-start gap-3">
      <div className="bg-plex-yellow/20 p-2 rounded-lg shrink-0">
        <ArrowDownTrayIcon className="h-5 w-5 text-plex-yellow" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium">Añadir a la pantalla de inicio</p>
        <p className="text-gray-400 text-xs mt-0.5">Accede a PlexDash como una app desde tu móvil.</p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 bg-plex-yellow text-plex-darker text-xs font-semibold rounded-lg hover:bg-plex-orange transition-colors"
          >
            Instalar
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 bg-gray-700 text-gray-300 text-xs rounded-lg hover:bg-gray-600 transition-colors"
          >
            No, gracias
          </button>
        </div>
      </div>
      <button onClick={handleDismiss} className="text-gray-600 hover:text-gray-400 shrink-0">
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
