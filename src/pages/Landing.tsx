// The landing page. Restructured to match a real product-marketing
// layout: a badge, a clear headline hierarchy, a row of equally-
// weighted action buttons, a "how it works" explainer, and a
// floating SOS button that stays reachable even after scrolling
// past the hero — rather than the earlier version's single centered
// button with everything else as an afterthought below it.

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Radio, HeartHandshake, Phone } from 'lucide-react';
import { Header } from '../components/Header';
import { QuickSosModal } from '../components/QuickSosModal';
import { useQuickSos } from '../hooks/useQuickSos';

// Verified against NDMA's and the Ministry of Home Affairs' own
// official pages, current as of 2026 — not something to guess at,
// since a wrong emergency number on a disaster app is a genuinely
// harmful mistake, not just an inaccuracy. 112 is India's single
// unified emergency number (routes to police/fire/medical); the
// others are the specific disaster-management lines this app's own
// use case is most directly relevant to.
const EMERGENCY_NUMBERS = [
  { number: '112', label: 'National Emergency Number', note: 'Police, fire, or medical — single number for any emergency' },
  { number: '108', label: 'Emergency Ambulance', note: 'Medical emergencies requiring transport' },
  { number: '101', label: 'Fire Brigade', note: 'Fire and rescue services' },
  { number: '1070', label: 'National Disaster Management Helpline', note: 'NDMA control room, Ministry of Home Affairs' },
  { number: '1078', label: 'Disaster Management Helpline', note: 'Ministry of Home Affairs' },
];

export function Landing() {
  const { t } = useTranslation();

  // Defined inside the component (not as a top-level constant) so
  // the titles/descriptions re-read from t() whenever the language
  // changes — a top-level array built once at import time would
  // freeze on whatever language loaded first.
  const steps = [
    { icon: MapPin, title: t('landing.step1Title'), description: t('landing.step1Desc') },
    { icon: Radio, title: t('landing.step2Title'), description: t('landing.step2Desc') },
    { icon: HeartHandshake, title: t('landing.step3Title'), description: t('landing.step3Desc') },
  ];

  // One shared hook instance for the WHOLE page — both the button in
  // the hero row and the floating button below call the same
  // .submit(), so there's only ever one modal, one status, one
  // source of truth, no matter which button was actually pressed.
  const sos = useQuickSos();

  return (
    <div className="min-h-screen bg-ink">
      <Header />

      {/* HERO — widened to max-w-6xl and split into a grid ONLY so
          the emergency-numbers card has somewhere to sit on larger
          screens; every existing element inside the left column
          below is completely unchanged. On small screens the grid
          collapses to a single column and the numbers card just sits
          underneath, matching how this page already behaved on
          mobile. */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-panel px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted">
              {t('landing.badge')}
            </span>

            <h1 className="mt-6 font-display text-5xl font-extrabold tracking-tight text-paper sm:text-6xl">Nirvaan</h1>
            <p className="mt-2 font-display text-2xl font-semibold text-signal-orange">{t('landing.subhead')}</p>
            <p className="mt-4 max-w-2xl text-muted">{t('landing.description')}</p>

            {/* Four buttons, equal visual weight — no single one crowds
                out the others. Emergency SOS still uses the shared hook
                above instead of navigating anywhere, since it submits
                immediately rather than opening a form. */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/request-help"
                className="rounded-lg bg-signal-orange px-5 py-3 font-semibold text-white transition hover:opacity-90"
              >
                {t('landing.requestHelpBtn')}
              </Link>
              <button
                onClick={sos.submit}
                disabled={sos.status === 'locating' || sos.status === 'sending'}
                className="rounded-lg bg-signal-red px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {t('landing.emergencySos')}
              </button>
              <Link
                to="/volunteer/signup"
                className="rounded-lg border border-hairline px-5 py-3 font-semibold text-paper transition hover:border-signal"
              >
                {t('landing.volunteerSignup')}
              </Link>
              <Link
                to="/ngo/signup"
                className="rounded-lg border border-hairline px-5 py-3 font-semibold text-paper transition hover:border-signal"
              >
                {t('landing.ngoSignup')}
              </Link>
            </div>

            <p className="mt-4 text-sm text-muted">{t('landing.disclaimer')}</p>
          </div>

          {/* Emergency numbers sidebar — a genuinely separate concern
              from the app's own SOS flow (this app connects you to
              volunteers/NGOs; these are the actual government
              emergency lines for immediate danger), so it's placed
              as its own clearly-labeled card rather than mixed into
              the hero's own messaging. */}
          <aside className="h-fit rounded-xl border border-hairline bg-panel p-5">
            <h2 className="font-display text-sm font-semibold text-paper">Government emergency numbers</h2>
            <ul className="mt-4 flex flex-col gap-4">
              {EMERGENCY_NUMBERS.map((item) => (
                <li key={item.number} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal/10 text-signal">
                    <Phone size={14} />
                  </div>
                  <div>
                    <a href={`tel:${item.number}`} className="font-data text-lg font-semibold text-paper hover:text-signal">
                      {item.number}
                    </a>
                    <p className="text-xs font-medium text-paper">{item.label}</p>
                    <p className="text-xs text-muted">{item.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-hairline bg-panel/40 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-2xl font-bold text-paper">{t('landing.howItWorks')}</h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {steps.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-xl border border-hairline bg-panel p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal/10 text-signal">
                  <Icon size={18} />
                </div>
                <p className="mt-4 font-semibold text-paper">{title}</p>
                <p className="mt-1 text-sm text-muted">{description}</p>
              </div>
            ))}
          </div>

          <Link to="/map" className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-signal hover:underline">
            {t('landing.liveMapLink')}
          </Link>
        </div>
      </section>

      <div className="px-6 py-8 text-center text-sm text-muted">
        {t('landing.alreadyVolunteer')}{' '}
        <Link to="/volunteer/login" className="text-signal hover:underline">
          {t('landing.logIn')}
        </Link>
      </div>

      {/* FLOATING SOS BUTTON — fixed to the viewport, so it's always
          reachable even after scrolling past the hero. Triggers the
          exact same submit() as the button in the row above. */}
      <button
        onClick={sos.submit}
        disabled={sos.status === 'locating' || sos.status === 'sending'}
        className="fixed bottom-6 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-signal-red font-display text-sm font-bold text-white shadow-[0_0_30px_rgba(220,38,38,0.5)] transition hover:scale-105 disabled:opacity-60"
      >
        SOS
      </button>

      <QuickSosModal status={sos.status} trackingId={sos.trackingId} error={sos.error} onClose={sos.reset} />
    </div>
  );
}
