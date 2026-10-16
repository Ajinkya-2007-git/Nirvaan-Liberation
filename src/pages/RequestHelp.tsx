// Public emergency request form (no login). Three numbered sections: your details, where help
// is needed (current location or a tapped pin), and what's happening. Keeps the same behaviour
// as before: AI triage when online, and saving on the device when there's no connection.
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, LocateFixed, Check, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Header } from '../components/Header';
import { EmergencyBar } from '../components/EmergencyBar';
import { LocationPicker } from '../components/LocationPicker';
import { usePlaceName } from '../hooks/usePlaceName';
import { queueSosSubmission } from '../lib/offlineQueue';

// Stores Indian mobile numbers in a consistent +91 form; anything else is kept as typed.
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const local = digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
  return local.length === 10 ? `+91${local}` : raw.trim();
}

// Numbered section heading.
function SectionTitle({ n, children }: { n: number; children: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-aqua text-sm font-semibold text-signal">{n}</span>
      <h2 className="font-display text-xl font-semibold text-paper">{children}</h2>
    </div>
  );
}

const inputClass =
  'mt-2 min-h-12 w-full rounded-xl border border-hairline bg-panel px-4 text-base text-paper placeholder:text-muted/70';

// Shared shell for the two result screens (kept outside the form so it isn't rebuilt on every keystroke).
function ResultScreen({ title, body, queued = false, children }: { title: string; body: string; queued?: boolean; children?: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-aqua text-signal">
          {queued ? <Clock size={30} /> : <Check size={30} />}
        </span>
        <h1 className="font-display text-2xl font-bold text-paper">{title}</h1>
        <p className="text-muted">{body}</p>
        {children}
      </div>
    </div>
  );
}

export function RequestHelp() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState<'self' | 'other'>('self');
  const [landmark, setLandmark] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const place = usePlaceName(location?.lat, location?.lng);

  function useCurrentLocation() {
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setError(t('form.locationError'));
        setLocating(false);
      },
      // A time limit so it can't hang forever with no signal.
      { timeout: 10000, maximumAge: 0 }
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!location) {
      setError(t('form.needLocation'));
      return;
    }
    setSubmitting(true);

    // Created here so the tracking link can be shown without reading the row back
    // (visitors without an account can create requests but not read them), and so a retry
    // after a bad connection is recognised as the same request, not a duplicate.
    const payload = {
      id: crypto.randomUUID(),
      reporter_name: name.trim(),
      reporter_phone: normalizePhone(phone),
      relationship,
      latitude: location.lat,
      longitude: location.lng,
      landmark: landmark.trim() || null,
      description: description.trim(),
      category: null as string | null,
      urgency: null as string | null,
    };

    // No connection: save on the device right away instead of waiting on requests that can't work.
    if (!navigator.onLine) {
      await queueSosSubmission(payload);
      setSubmitting(false);
      setQueued(true);
      return;
    }

    // AI triage. If it fails for any reason the request still goes through, just unclassified.
    try {
      const { data: classification, error: fnError } = await supabase.functions.invoke('classify-request', {
        body: { description: payload.description },
      });
      if (!fnError && classification) {
        payload.category = classification.category;
        payload.urgency = classification.urgency;
      } else {
        console.error('Classification did not return a result:', fnError, classification);
      }
    } catch (err) {
      console.error('Classification call threw an error:', err);
    }

    // Save it. Any failure falls back to the on-device queue, which syncs later.
    try {
      const { error: insertError } = await supabase.from('sos_requests').insert(payload);
      if (insertError) throw insertError;
      setSubmitting(false);
      setTrackingId(payload.id);
    } catch (err) {
      await queueSosSubmission(payload);
      setSubmitting(false);
      setQueued(true);
      console.error('Insert failed, queued offline instead:', err);
    }
  }

  if (queued) {
    return (
      <ResultScreen title={t('form.queuedTitle')} body={t('form.queuedBody')} queued>
        <Link to="/" className="font-semibold text-signal hover:underline">
          {t('form.backHome')}
        </Link>
      </ResultScreen>
    );
  }

  if (trackingId) {
    return (
      <ResultScreen title={t('requestHelp.confirmTitle')} body={t('requestHelp.confirmBody')}>
        <div className="w-full rounded-xl border border-hairline bg-panel px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted">{t('requestHelp.trackingId')}</p>
          <p className="font-data text-lg text-paper">{trackingId.slice(0, 8)}</p>
        </div>
        {/* Full id for the link; the short one above is just for reading out loud. */}
        <Link
          to={`/track/${trackingId}`}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-signal px-4 font-semibold text-white hover:opacity-90"
        >
          {t('form.track')}
        </Link>
        <Link to="/" className="font-semibold text-signal hover:underline">
          {t('form.backHome')}
        </Link>
      </ResultScreen>
    );
  }

  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <EmergencyBar />

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-signal hover:underline">
          <ArrowLeft size={16} />
          {t('form.back')}
        </Link>
        <h1 className="mt-5 font-display text-4xl font-bold text-paper">{t('form.title')}</h1>
        <p className="mt-3 text-lg text-muted">{t('form.lead')}</p>
        <p className="mt-3 text-sm text-muted">{t('form.required')}</p>

        {/* 1. YOUR DETAILS */}
        <div className="mt-8">
          <SectionTitle n={1}>{t('form.s1')}</SectionTitle>

          <label className="mt-5 block text-sm font-semibold text-paper">
            {t('form.name')} *
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('form.namePlaceholder') ?? undefined}
              className={inputClass}
            />
          </label>

          <label className="mt-5 block text-sm font-semibold text-paper">
            {t('form.phone')} *
            <div className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-hairline bg-panel px-4 focus-within:border-signal">
              <span className="text-base text-muted">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('form.phonePlaceholder') ?? undefined}
                className="min-h-11 w-full bg-transparent text-base font-normal text-paper outline-none placeholder:text-muted/70"
              />
            </div>
          </label>
          <p className="mt-2 text-sm text-muted">{t('form.phoneHint')}</p>

          <p className="mt-5 text-sm font-semibold text-paper">{t('form.whoNeeds')} *</p>
          <div className="mt-2 grid grid-cols-2 gap-3" role="radiogroup">
            {(['self', 'other'] as const).map((value) => {
              const selected = relationship === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setRelationship(value)}
                  className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 text-base font-medium text-paper transition ${
                    selected ? 'border-signal bg-aqua' : 'border-hairline bg-panel'
                  }`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? 'border-signal' : 'border-muted'}`}>
                    {selected && <span className="h-2.5 w-2.5 rounded-full bg-signal" />}
                  </span>
                  {value === 'self' ? t('form.myself') : t('form.someone')}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. WHERE */}
        <div className="mt-10">
          <SectionTitle n={2}>{t('form.s2')}</SectionTitle>
          <p className="mt-3 text-muted">{t('form.locHint')}</p>

          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-panel font-semibold text-paper transition hover:border-signal disabled:opacity-60"
          >
            <LocateFixed size={18} />
            {locating ? t('form.locating') : t('form.useLocation')}
          </button>

          <div className="mt-4 overflow-hidden rounded-xl border border-hairline bg-panel">
            <LocationPicker value={location} onChange={(lat, lng) => setLocation({ lat, lng })} className="h-64 sm:h-80" />
            <div className="border-t border-hairline px-4 py-3">
              <p className="font-semibold text-paper">{location ? (place ?? t('form.selected')) : t('form.tapMap')}</p>
              <p className="mt-0.5 text-sm text-muted">
                {location ? `${t('form.selected')} · ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : t('form.notSelected')}
              </p>
            </div>
          </div>

          <label className="mt-5 block text-sm font-semibold text-paper">
            {t('form.landmark')} · <span className="font-normal text-muted">{t('form.optional')}</span>
            <input
              type="text"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder={t('form.landmarkPlaceholder') ?? undefined}
              className={inputClass}
            />
          </label>
        </div>

        {/* 3. WHAT'S HAPPENING */}
        <div className="mt-10">
          <SectionTitle n={3}>{t('form.s3')}</SectionTitle>
          <label className="mt-5 block text-sm font-semibold text-paper">
            {t('form.describe')} *
            <textarea
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('form.describePlaceholder') ?? undefined}
              className="mt-2 w-full rounded-xl border border-hairline bg-panel px-4 py-3 text-base text-paper placeholder:text-muted/70"
            />
          </label>
        </div>

        {error && <p className="mt-6 text-sm font-medium text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-8 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-signal text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          <ArrowRight size={20} />
          {submitting ? t('form.sending') : t('form.submit')}
        </button>
      </form>
    </div>
  );
}
