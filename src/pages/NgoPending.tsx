// Shown right after an NGO submits their details, AND every time a
// still-pending NGO logs in afterward (see Login.tsx) — this is the
// literal message from the original spec: "Your organization is
// under review. You'll be notified once approved." An NGO can't get
// past this screen into the live map until an admin flips their
// status in the AdminNgoApprovals page.

import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';

export function NgoPending() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-paper">{t('ngoPending.title')}</h1>
        <p className="text-muted">{t('ngoPending.message')}</p>
      </div>
    </div>
  );
}
