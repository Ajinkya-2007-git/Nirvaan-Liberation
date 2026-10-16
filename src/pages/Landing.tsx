// Home page: emergency actions first (Request Help, then SOS, then Call 112), then the live
// map preview, ways to join, emergency contacts, and how help is coordinated.
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HandHelping, Siren, Phone, ArrowUpRight, Users, Building2 } from 'lucide-react';
import { Header } from '../components/Header';
import { EmergencyBar } from '../components/EmergencyBar';
import { MapPreview } from '../components/MapPreview';
import { Footer } from '../components/Footer';
import { QuickSosModal } from '../components/QuickSosModal';
import { useQuickSos } from '../hooks/useQuickSos';

export function Landing() {
  const { t } = useTranslation();
  const location = useLocation();
  // One shared Quick SOS flow (location -> save -> confirmation modal).
  const sos = useQuickSos();

  // The "Join the network" menu link points to /#join: scroll there when it's in the URL.
  useEffect(() => {
    if (location.hash === '#join') document.getElementById('join')?.scrollIntoView({ behavior: 'smooth' });
  }, [location]);

  // Verified national numbers (112 is the unified emergency number).
  const contacts = [
    { number: '112', label: t('emergency.nationalNumber'), danger: true },
    { number: '108', label: t('emergency.ambulance'), danger: false },
    { number: '101', label: t('emergency.fire'), danger: false },
    { number: '1070', label: t('emergency.ndmh'), danger: false },
    { number: '1078', label: t('emergency.dmh'), danger: false },
  ];

  const steps = [
    { n: 1, title: t('home.step1'), body: t('home.step1Body') },
    { n: 2, title: t('home.step2'), body: t('home.step2Body') },
    { n: 3, title: t('home.step3'), body: t('home.step3Body') },
  ];

  const sosBusy = sos.status === 'locating' || sos.status === 'sending';

  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <EmergencyBar />

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* HERO */}
        <section className="grid gap-8 py-8 lg:grid-cols-2 lg:items-center lg:py-12">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-signal">
              <HandHelping size={14} />
              {t('home.eyebrow')}
            </p>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-paper sm:text-5xl lg:text-6xl">
              {t('home.headline')}
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">{t('home.lead')}</p>

            <Link
              to="/request-help"
              className="mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-signal text-base font-semibold text-white transition hover:opacity-90"
            >
              <HandHelping size={20} />
              {t('home.requestHelp')}
            </Link>
            <p className="mt-2 text-sm text-muted">{t('home.requestHelpNote')}</p>

            {/* Emergency SOS: its own card, kept apart from the main action. */}
            <div className="mt-5 rounded-2xl bg-blush p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <div className="mb-3 sm:mb-0">
                <p className="hidden font-semibold text-paper sm:block">{t('home.sosTitle')}</p>
                <p className="text-sm text-muted">{t('home.sosBody')}</p>
              </div>
              <button
                onClick={sos.submit}
                disabled={sosBusy}
                className="flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-signal-red px-6 font-semibold text-white transition hover:opacity-90 disabled:opacity-60 sm:w-auto"
              >
                <Siren size={18} />
                {t('home.sos')}
              </button>
            </div>

            {/* Phone only: Call 112 as its own card (desktop has it in the contacts strip). */}
            <a
              href="tel:112"
              className="mt-5 flex min-h-16 items-center justify-between rounded-2xl border border-hairline bg-panel px-5 py-4 sm:hidden"
            >
              <span className="flex items-center gap-4">
                <Phone size={26} className="text-danger" />
                <span>
                  <span className="block font-display text-2xl font-bold text-danger">{t('emergency.call112')}</span>
                  <span className="block text-sm text-muted">{t('emergency.nationalNumber')}</span>
                </span>
              </span>
              <ArrowUpRight size={20} className="text-danger" />
            </a>
          </div>

          <MapPreview />
        </section>

        {/* EMERGENCY CONTACTS: desktop strip */}
        <section className="hidden rounded-2xl border border-hairline bg-panel p-6 sm:block">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-display text-lg font-semibold text-paper">{t('emergency.contactsTitle')}</h2>
            <p className="text-sm text-muted">{t('emergency.contactsHint')}</p>
          </div>
          <div className="mt-5 grid grid-cols-5 gap-4">
            {contacts.map((c) => (
              <a key={c.number} href={`tel:${c.number}`} className="group">
                <span className={`flex items-center gap-2 font-display text-2xl ${c.danger ? 'text-danger' : 'text-signal'}`}>
                  <Phone size={18} />
                  {c.number}
                </span>
                <span className="mt-1 block text-sm text-muted group-hover:text-paper">{c.label}</span>
              </a>
            ))}
          </div>
        </section>

        {/* JOIN */}
        <section id="join" className="scroll-mt-24 py-10 sm:py-8">
          <h2 className="mb-4 font-display text-2xl font-bold text-paper sm:sr-only">{t('home.joinTitle')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { Icon: Users, title: t('home.volunteer'), body: t('home.volunteerBody'), up: '/volunteer/signup' },
              { Icon: Building2, title: t('home.ngo'), body: t('home.ngoBody'), up: '/ngo/signup' },
            ].map(({ Icon, title, body, up }) => (
              <div key={title} className="relative flex gap-4 rounded-2xl border border-hairline bg-aqua p-5">
                <Icon size={28} className="mt-1 shrink-0 text-signal" />
                <div>
                  <h3 className="font-display text-lg font-semibold text-paper">{title}</h3>
                  <p className="mt-1 text-muted">{body}</p>
                  <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-signal">
                    <Link to={up} className="inline-flex items-center gap-1 hover:underline">
                      {t('home.signUp')}
                      <ArrowUpRight size={13} />
                    </Link>
                    <span aria-hidden>·</span>
                    <Link to="/volunteer/login" className="hover:underline">
                      {t('home.logIn')}
                    </Link>
                  </p>
                </div>
                <ArrowUpRight size={18} className="absolute right-5 top-5 hidden text-signal sm:block" />
              </div>
            ))}
          </div>
        </section>

        {/* EMERGENCY CONTACTS: phone list */}
        <section className="pb-6 sm:hidden">
          <h2 className="mb-3 font-display text-2xl font-bold text-paper">{t('emergency.contactsTitle')}</h2>
          <ul className="rounded-2xl border border-hairline bg-panel px-5">
            {contacts.slice(1).map((c) => (
              <li key={c.number} className="border-b border-hairline last:border-0">
                <a href={`tel:${c.number}`} className="flex min-h-16 items-center gap-4 py-3">
                  <span className="w-16 font-display text-2xl text-signal">{c.number}</span>
                  <span className="flex-1 text-sm text-paper">{c.label}</span>
                  <Phone size={20} className="text-signal" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* HOW HELP IS COORDINATED */}
        <section className="py-6 sm:py-10">
          <h2 className="font-display text-2xl font-bold text-paper">{t('home.howTitle')}</h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aqua font-semibold text-signal">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-paper">{s.title}</h3>
                  <p className="mt-1 text-muted">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
      <QuickSosModal status={sos.status} trackingId={sos.trackingId} error={sos.error} onClose={sos.reset} />
    </div>
  );
}
