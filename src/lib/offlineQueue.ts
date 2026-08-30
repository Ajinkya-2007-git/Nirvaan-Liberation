// This is the actual "survives zero signal" logic. IndexedDB is a
// small database built into every browser, separate from anything
// on the network — writes to it succeed even with the phone in
// airplane mode. When someone submits an SOS with no connection, we
// save it HERE first, then try to sync it to Supabase whenever a
// connection becomes available (see useOfflineSync.ts).
//
// "idb" is a small, well-tested wrapper around the browser's native
// IndexedDB API, which is otherwise quite clunky to use directly —
// it just makes the same operations feel like normal async/await
// code instead of old-style callback events.

import { openDB, type DBSchema } from 'idb';

// Describes the shape of one queued submission — deliberately a
// loose shape (a plain object of whatever fields the insert needs)
// rather than our full SosRequest type, since a queued item never
// has an id/status/created_at yet — those only exist once it
// actually reaches the database.
export interface QueuedSosSubmission {
  // A temporary local id, generated on THIS device, purely so we can
  // find and remove one specific queued item later — nothing to do
  // with the real database id it'll get once synced.
  localId: string;
  queuedAt: string;
  payload: Record<string, unknown>;
}

interface OfflineDB extends DBSchema {
  'pending-sos': {
    key: string;
    value: QueuedSosSubmission;
  };
}

// Opens (creating if needed) a database named "nirvaan-offline" with
// one "table" (called an object store) named "pending-sos".
const dbPromise = openDB<OfflineDB>('nirvaan-offline', 1, {
  upgrade(db) {
    db.createObjectStore('pending-sos', { keyPath: 'localId' });
  },
});

export async function queueSosSubmission(payload: Record<string, unknown>): Promise<void> {
  const db = await dbPromise;
  await db.add('pending-sos', {
    localId: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
    payload,
  });
}

export async function getQueuedSubmissions(): Promise<QueuedSosSubmission[]> {
  const db = await dbPromise;
  return db.getAll('pending-sos');
}

export async function removeQueuedSubmission(localId: string): Promise<void> {
  const db = await dbPromise;
  await db.delete('pending-sos', localId);
}
