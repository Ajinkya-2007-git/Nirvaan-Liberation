// One-tap SOS: grab the device location, send it, and report what happened. With no connection
// the request is saved on the device and sent automatically once back online.
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { queueSosSubmission } from '../lib/offlineQueue';

export type QuickSosStatus = 'idle' | 'locating' | 'sending' | 'done' | 'error' | 'queued';

export function useQuickSos() {
  const [status, setStatus] = useState<QuickSosStatus>('idle');
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function submit() {
    setStatus('locating');
    setError('');

    if (!navigator.geolocation) {
      setStatus('error');
      setError('Your device does not support location. Please use the Request Help form instead.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setStatus('sending');

        // The id is created here instead of by the database, so the tracking link can be shown
        // without reading the row back (visitors without an account can create requests but can
        // no longer read them). It also lets a retry after a bad connection be recognised as the
        // same request instead of creating a duplicate.
        const id = crypto.randomUUID();
        const payload = {
          id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          description: 'Quick SOS — no additional details provided.',
        };

        try {
          if (!navigator.onLine) throw new Error('offline');

          const { error: insertError } = await supabase.from('sos_requests').insert(payload);
          if (insertError) throw insertError;

          setTrackingId(id);
          setStatus('done');
        } catch {
          // Any failure: keep it safe on the device and send it later.
          await queueSosSubmission(payload);
          setStatus('queued');
        }
      },
      () => {
        setStatus('error');
        setError('Could not access your location. Please allow location access and try again.');
      },
      // A time limit so this can't hang forever when the device can't get a fix.
      { timeout: 10000, maximumAge: 0 }
    );
  }

  // Lets the modal return to idle once closed.
  function reset() {
    setStatus('idle');
    setTrackingId(null);
    setError('');
  }

  return { status, trackingId, error, submit, reset };
}
