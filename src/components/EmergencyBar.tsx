// The soft-red strip at the top of public pages: always puts "call emergency services
// first" ahead of everything else.
import { useTranslation } from 'react-i18next';
import { TriangleAlert, ArrowUpRight } from 'lucide-react';

export function EmergencyBar() {
  const { t } = useTranslation();
  return (
    <div className="border-b border-signal-red/20 bg-blush">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-6">
        <p className="flex items-center gap-2 text-danger">
          <TriangleAlert size={16} className="shrink-0" />
          {t('emergency.banner')}
        </p>
        <a href="tel:112" className="hidden shrink-0 items-center gap-1 font-semibold text-danger sm:inline-flex">
          {t('emergency.call112')}
          <ArrowUpRight size={14} />
        </a>
      </div>
    </div>
  );
}
