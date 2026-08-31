// Shows the Quick SOS flow's current status as a centered overlay.
// It's a modal (not a full-page swap) specifically so the floating
// SOS button still makes sense — pressing it while scrolled down the
// page shouldn't yank you back to the top.

import { useTranslation } from 'react-i18next';
import type { QuickSosStatus } from '../hooks/useQuickSos';

interface QuickSosModalProps {
  status: QuickSosStatus;
  trackingId: string | null;
  error: string;
  onClose: () => void;
}

export function QuickSosModal({ status, trackingId, error, onClose }: QuickSosModalProps) {
  const { t } = useTranslation();
  // Nothing to show while idle — this is what makes the modal
  // invisible until a button actually gets pressed.
  if (status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-sm rounded-xl border border-hairline bg-panel p-6 text-center">
        {(status === 'locating' || status === 'sending') && (
          <>
            <p className="font-display text-lg font-semibold text-paper">
              {status === 'locating' ? t('quickSosModal.gettingLocation') : t('quickSosModal.sendingSos')}
            </p>
            <p className="mt-1 text-sm text-muted">{t('quickSosModal.keepOpen')}</p>
          </>
        )}

        {status === 'done' && trackingId && (
          <>
            <p className="font-display text-lg font-semibold text-paper">{t('quickSosModal.helpOnWay')}</p>
            <p className="mt-1 text-sm text-muted">{t('quickSosModal.locationSent')}</p>
            <p className="mt-3 font-data text-lg text-paper">{trackingId.slice(0, 8)}</p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-md bg-signal px-4 py-2 font-semibold text-white hover:opacity-90"
            >
              {t('quickSosModal.close')}
            </button>
          </>
        )}

        {status === 'queued' && (
          <>
            <p className="font-display text-lg font-semibold text-paper">{t('quickSosModal.savedNoConnection')}</p>
            <p className="mt-1 text-sm text-muted">{t('quickSosModal.savedNoConnectionBody')}</p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-md bg-signal px-4 py-2 font-semibold text-white hover:opacity-90"
            >
              {t('quickSosModal.close')}
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="font-display text-lg font-semibold text-paper">{t('quickSosModal.somethingWrong')}</p>
            <p className="mt-1 text-sm text-red-400">{error}</p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-md border border-hairline px-4 py-2 font-semibold text-paper hover:border-signal"
            >
              {t('quickSosModal.close')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
