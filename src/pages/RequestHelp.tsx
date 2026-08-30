// This is the public emergency request form. Deliberately no login
// required — see schema.sql's "anyone can submit an sos request"
// policy, which is what makes this actually work against the
// database without an account.

import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { LocationPicker } from '../components/LocationPicker';
import { Header } from '../components/Header';
import { queueSosSubmission } from '../lib/offlineQueue';
import type { Relationship } from '../lib/types';

export function RequestHelp() {
  const { t } = useTranslation();
  // One piece of state per form field. We could combine these into
  // one big object, but keeping them separate makes each input's
  // code easier to read for now — a fine tradeoff for a form this size.
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('self');
  const [landmark, setLandmark] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Tracks whether we're mid-submit, so we can disable the button
  // and show "Sending..." instead of letting someone double-click
  // and accidentally create two identical emergency requests.
  const [submitting, setSubmitting] = useState(false);

  // Holds an error message to show the user if something goes wrong
  // (e.g. no internet). Empty string = no error.
  const [error, setError] = useState('');

  // Once the request is successfully saved, we store its ID here.
  // Its presence is also what flips the screen over to the
  // confirmation view — see the "if (trackingId)" check below.
  const [trackingId, setTrackingId] = useState<string | null>(null);

  // True when there's genuinely no connection and the submission got
  // saved locally instead — a DIFFERENT outcome from trackingId
  // above, since there's no real database id yet (it doesn't exist
  // on the server until this device syncs it later).
  const [queued, setQueued] = useState(false);

  // Runs when the form is submitted (button clicked or Enter pressed).
  async function handleSubmit(e: FormEvent) {
    // Stops the browser's default behavior of reloading the whole
    // page on form submit — we want to handle it with JavaScript instead.
    e.preventDefault();

    // Guard clause: don't let the request through without a location,
    // since latitude/longitude are required (not-null) columns in
    // the database and the insert would fail anyway — this just
    // gives a friendlier error before we even try.
    if (!location) {
      setError('Please tap the map to mark the location.');
      return;
    }

    setSubmitting(true);
    setError('');

    const payload = {
      reporter_name: reporterName,
      reporter_phone: reporterPhone,
      relationship,
      latitude: location.lat,
      longitude: location.lng,
      landmark,
      description,
      category: null as string | null,
      urgency: null as string | null,
    };

    // If there's genuinely no connection, skip straight to queuing —
    // no point spending several seconds waiting on an AI
    // classification call and a database insert that are both
    // guaranteed to fail anyway. Someone in an emergency shouldn't
    // have to wait out a timeout to find out they're offline.
    if (!navigator.onLine) {
      await queueSosSubmission(payload);
      setSubmitting(false);
      setQueued(true);
      return;
    }

    // STEP 1: ask the AI classification edge function to read the
    // description and return a category + urgency. This is wrapped
    // in its own try/catch on purpose — if this call fails for ANY
    // reason (no internet, the AI provider having a bad moment,
    // whatever), we do NOT want that to block someone's actual
    // emergency submission. Worst case, category/urgency just stay
    // empty and the pin shows up black — a real, working fallback
    // state that already exists elsewhere in this app, not a broken
    // one.
    try {
      const { data: classification, error: fnError } = await supabase.functions.invoke('classify-request', {
        body: { description },
      });
      if (!fnError && classification) {
        payload.category = classification.category;
        payload.urgency = classification.urgency;
      } else {
        // Logs the exact reason classification didn't work to the
        // browser console (F12 → Console) — never shown to the end
        // user, but genuinely useful for catching future issues
        // rather than something to remove before launch.
        console.error('Classification did not return a result:', fnError, classification);
      }
    } catch (err) {
      console.error('Classification call threw an error:', err);
    }

    // STEP 2: save the request, now including whatever the AI
    // decided (or null/null if that call didn't work out). Any
    // failure here — not just an explicit network error, but ANYTHING
    // that stops this insert from succeeding — falls back to the
    // same offline queue as above. A flaky connection can fail a
    // request even while navigator.onLine still reports "true", so
    // this catch-all is what actually makes the offline guarantee
    // hold up in practice, not just the explicit check above.
    try {
      const { data, error: insertError } = await supabase.from('sos_requests').insert(payload).select().single();

      if (insertError) throw insertError;

      setSubmitting(false);
      setTrackingId(data.id);
    } catch (err) {
      await queueSosSubmission(payload);
      setSubmitting(false);
      setQueued(true);
      console.error('Insert failed, queued offline instead:', err);
    }
  }

  // OFFLINE-QUEUED SCREEN — shown when there was no way to actually
  // reach the server, but the submission is safely saved on this
  // device and will send itself once a connection returns (see
  // useOfflineSync.ts, which runs globally in App.tsx).
  if (queued) {
    return (
      <div className="min-h-screen bg-ink">
        <Header />
        <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 px-6 py-24 text-center">
          <div className="rounded-full bg-signal-orange/10 p-4">
            <svg className="h-10 w-10 text-signal-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-semibold text-paper">Saved — no connection right now</h1>
          <p className="text-muted">
            Your request was saved on this device. It will send automatically the moment you're back online — you
            don't need to submit it again.
          </p>
        </div>
      </div>
    );
  }

  // CONFIRMATION SCREEN — shown instead of the form once a request
  // has been successfully saved.
  if (trackingId) {
    return (
      <div className="min-h-screen bg-ink">
        <Header />
        <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 px-6 py-24 text-center">
          <div className="rounded-full bg-signal/10 p-4">
            <svg className="h-10 w-10 text-signal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-semibold text-paper">{t('requestHelp.confirmTitle')}</h1>
          <p className="text-muted">{t('requestHelp.confirmBody')}</p>
          <div className="mt-2 rounded-lg border border-hairline bg-panel px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted">{t('requestHelp.trackingId')}</p>
            {/* .slice(0, 8) shows a short, readable piece of the id
                instead of the full 36-character UUID — easier for
                someone to read aloud over a phone call if needed. */}
            <p className="font-data text-lg text-paper">{trackingId.slice(0, 8)}</p>
          </div>
        </div>
      </div>
    );
  }

  // THE FORM — shown by default, before submission.
  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <div className="mx-auto max-w-lg px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-paper">{t('requestHelp.title')}</h1>
        <p className="mt-1 text-muted">{t('requestHelp.subtitle')}</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-paper">{t('requestHelp.yourName')}</label>
            <input
              type="text"
              required
              value={reporterName}
              // Every input follows this same pattern: read the
              // current value from state, and on every keystroke
              // ("onChange") write the new value back into state.
              // This is called a "controlled input" in React.
              onChange={(e) => setReporterName(e.target.value)}
              className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper focus:border-signal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper">{t('requestHelp.phoneNumber')}</label>
            <input
              type="tel"
              required
              value={reporterPhone}
              onChange={(e) => setReporterPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper focus:border-signal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper">{t('requestHelp.whoNeedsHelp')}</label>
            <select
              value={relationship}
              // The cast "as Relationship" tells TypeScript to trust
              // that this string is one of our four allowed values —
              // safe here because the <option> values below are the
              // only options the user could possibly pick.
              onChange={(e) => setRelationship(e.target.value as Relationship)}
              className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper"
            >
              <option value="self">{t('requestHelp.relationshipSelf')}</option>
              <option value="relative">{t('requestHelp.relationshipRelative')}</option>
              <option value="neighbor">{t('requestHelp.relationshipNeighbor')}</option>
              <option value="other">{t('requestHelp.relationshipOther')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-paper">{t('requestHelp.location')}</label>
            <div className="mt-1">
              <LocationPicker value={location} onChange={(lat, lng) => setLocation({ lat, lng })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-paper">{t('requestHelp.landmark')}</label>
            <input
              type="text"
              placeholder={t('requestHelp.landmarkPlaceholder') ?? undefined}
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper focus:border-signal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper">{t('requestHelp.description')}</label>
            <textarea
              required
              rows={3}
              placeholder={t('requestHelp.descriptionPlaceholder') ?? undefined}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper focus:border-signal focus:outline-none"
            />
          </div>

          {/* Only rendered when there's actually an error to show. */}
          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[#dc2626] px-4 py-3 font-semibold text-white transition hover:bg-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t('requestHelp.sending') : t('requestHelp.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
