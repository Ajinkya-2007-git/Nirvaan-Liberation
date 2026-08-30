// The actual "press SOS -> get location -> save to database" logic,
// pulled into its own hook so BOTH the button in the hero row AND
// the floating button that follows you down the page can trigger
// the exact same behavior — one source of truth instead of copying
// this logic into two separate components.

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { queueSosSubmission } from '../lib/offlineQueue';

// "queued" is new — this is the actual offline behavior. Instead of
// showing an error when there's no connection, we save the
// submission locally and tell the person it'll send automatically
// once they're back online, rather than making them feel like
// pressing SOS with no signal just failed outright.
export type QuickSosStatus = 'idle' | 'locating' | 'sending' | 'done' | 'error' | 'queued';

export function useQuickSos() {
  const [status, setStatus] = useState<QuickSosStatus>('idle');
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function submit() {
    setStatus('locating');
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setStatus('sending');

        const payload = {
          // reporter_name/reporter_phone intentionally omitted —
          // see allow-quick-sos.sql, which made these columns
          // optional specifically for this no-form flow.
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          // description still can't be truly empty (the database
          // requires SOME text there), so we send a clear, honest
          // placeholder instead of a blank string.
          description: 'Quick SOS — no additional details provided.',
        };

        // We treat "no connection right now" and "the request failed
        // for some other network-shaped reason" the same way: queue
        // it locally. navigator.onLine is checked FIRST so an
        // obviously offline device skips straight to queuing instead
        // of waiting on a request that's guaranteed to fail anyway —
        // but we still fall into the same catch block if a request
        // is attempted and fails for any reason, since "online"
        // isn't always a fully reliable signal on its own.
        try {
          if (!navigator.onLine) throw new Error('offline');

          const { data, error: insertError } = await supabase
            .from('sos_requests')
            .insert(payload)
            .select()
            .single();

          if (insertError) throw insertError;

          setTrackingId(data.id);
          setStatus('done');
        } catch {
          await queueSosSubmission(payload);
          setStatus('queued');
        }
      },
      () => {
        setStatus('error');
        setError('Could not access your location. Please allow location access and try again.');
      },
      // This third argument is the actual fix. getCurrentPosition has
      // NO timeout by default — if the device's location provider
      // can't get a fix (which can happen offline, since some
      // location lookups lean on network/WiFi data, not just GPS),
      // it would otherwise just wait forever, calling neither
      // callback and leaving the button stuck on "Locating..."
      // permanently. 10 seconds is generous enough for a real GPS
      // fix, but still a hard, visible failure instead of an
      // invisible hang.
      { timeout: 10000, maximumAge: 0 }
    );
  }

  // Lets the modal reset back to nothing once the user closes it,
  // so pressing SOS again later starts fresh instead of reopening
  // the same old confirmation.
  function reset() {
    setStatus('idle');
    setTrackingId(null);
    setError('');
  }

  return { status, trackingId, error, submit, reset };
}
