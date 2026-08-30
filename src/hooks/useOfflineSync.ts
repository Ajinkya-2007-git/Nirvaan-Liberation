// Watches for the browser regaining a connection and, when it does,
// tries to actually send every queued offline submission to
// Supabase. This is the other half of offlineQueue.ts — saving a
// submission locally is only useful if something eventually tries
// to deliver it for real.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getQueuedSubmissions, removeQueuedSubmission } from '../lib/offlineQueue';

export function useOfflineSync() {
  // How many submissions are currently sitting in the queue,
  // unsent — used to show a small "X pending" indicator in the UI.
  const [pendingCount, setPendingCount] = useState(0);

  async function refreshCount() {
    const queued = await getQueuedSubmissions();
    setPendingCount(queued.length);
  }

  async function trySync() {
    const queued = await getQueuedSubmissions();

    for (const item of queued) {
      // Classify NOW, at sync time — the payload was queued with
      // category/urgency left null (there was no connection to ask
      // the AI when it was first saved), so this is the one and
      // only chance for it to actually get triaged. Wrapped in the
      // same try/catch pattern as the online submission path: if
      // classification fails for any reason, the request still
      // syncs with category/urgency left null rather than getting
      // stuck in the queue forever over a triage failure.
      let category: string | null = null;
      let urgency: string | null = null;
      const description = item.payload.description as string | undefined;
      if (description) {
        try {
          const { data: classification, error: fnError } = await supabase.functions.invoke('classify-request', {
            body: { description },
          });
          if (!fnError && classification) {
            category = classification.category;
            urgency = classification.urgency;
          }
        } catch (err) {
          console.error('Offline-sync classification failed:', err);
        }
      }

      const { error } = await supabase.from('sos_requests').insert({ ...item.payload, category, urgency });

      // Only remove it from the queue once we're SURE it actually
      // made it to the database — if this fails again (still
      // offline, or a fresh network hiccup), it stays queued and
      // we'll simply try again next time.
      if (!error) {
        await removeQueuedSubmission(item.localId);
      }
    }

    await refreshCount();
  }

  useEffect(() => {
    // Check once immediately when the app loads — covers the case
    // where someone submitted offline, closed the tab, and reopened
    // it later already back online.
    trySync();
    refreshCount();

    // The browser's own "online" event fires the moment connectivity
    // returns — this is what makes syncing automatic rather than
    // requiring someone to manually retry.
    window.addEventListener('online', trySync);
    return () => window.removeEventListener('online', trySync);
  }, []);

  return { pendingCount };
}
