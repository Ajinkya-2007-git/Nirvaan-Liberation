// Sends requests that were saved on the device while offline, as soon as a connection exists.
// Runs for the whole app (see App.tsx), so it works on any page.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getQueuedSubmissions, removeQueuedSubmission } from '../lib/offlineQueue';

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  // Only one sync at a time: the "back online" event and the start-up check can fire together,
  // and two overlapping syncs would send the same saved request twice.
  const syncing = useRef(false);

  const refreshCount = useCallback(async () => {
    const queued = await getQueuedSubmissions();
    setPendingCount(queued.length);
  }, []);

  const trySync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const queued = await getQueuedSubmissions();

      for (const item of queued) {
        // Offline requests skipped the AI triage, so do it now that there's a connection.
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

        // The request id was fixed when it was saved, so sending it again after a half-finished
        // attempt can never create a second copy.
        const id = (item.payload.id as string | undefined) ?? item.localId;
        const { error } = await supabase.from('sos_requests').insert({ ...item.payload, id, category, urgency });

        // 23505 = "already exists": an earlier attempt did reach the server, so this one is done.
        if (!error || error.code === '23505') {
          await removeQueuedSubmission(item.localId);
        }
        // Any other error: leave it saved and try again next time.
      }
    } finally {
      syncing.current = false;
      await refreshCount();
    }
  }, [refreshCount]);

  useEffect(() => {
    // Covers someone who submitted offline, closed the tab and came back already online.
    void trySync();
    window.addEventListener('online', trySync);
    return () => window.removeEventListener('online', trySync);
  }, [trySync]);

  return { pendingCount };
}
