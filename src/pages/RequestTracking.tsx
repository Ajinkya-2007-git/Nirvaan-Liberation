// The reporter's own page for their request, opened from the link on the confirmation screen.
// No login: the request's unguessable id is the key. It reads through a narrow database function
// that returns only status, description and the responder's NAME (never phone numbers or location),
// and refreshes every few seconds.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Header } from '../components/Header';
import { RequestChat } from '../components/RequestChat';

interface Tracking {
  id: string;
  status: 'pending' | 'assigned' | 'en_route' | 'resolved';
  description: string;
  assigned_responder_type: 'volunteer' | 'ngo' | null;
  has_responder: boolean;
  responder_name: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Waiting for a responder',
  assigned: 'A responder has been assigned',
  en_route: 'Help is on the way',
  resolved: 'Resolved',
};

export function RequestTracking() {
  const { requestId } = useParams<{ requestId: string }>();
  const [request, setRequest] = useState<Tracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Remembers whether we've ever loaded it, so a brief network drop later doesn't flip the page
  // to "not found".
  const loadedOnce = useRef(false);

  useEffect(() => {
    if (!requestId) return;
    let active = true;

    async function load() {
      const { data, error } = await supabase.rpc('get_request_tracking', { p_request_id: requestId });
      if (!active) return;
      const row = (Array.isArray(data) ? data[0] : data) as Tracking | undefined;
      if (!error && row) {
        loadedOnce.current = true;
        setNotFound(false);
        setRequest(row);
      } else if (!loadedOnce.current) {
        setNotFound(true);
      }
      setLoading(false);
    }

    void load();
    // Status changes (assigned -> en route -> resolved) appear without reloading.
    const timer = setInterval(load, 8000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [requestId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (notFound || !request) {
    return (
      <div className="min-h-screen bg-ink">
        <Header />
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <p className="text-muted">This tracking link doesn't match any request.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <div className="mx-auto max-w-lg px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-paper">Your request</h1>
        <p className="mt-1 font-data text-xs text-muted">Tracking ID: {request.id.slice(0, 8)}</p>

        <div className="mt-4 rounded-xl border border-hairline bg-panel p-4">
          <p className="text-sm font-semibold text-signal">{STATUS_LABEL[request.status]}</p>
          <p className="mt-2 text-sm text-paper">{request.description}</p>
        </div>

        <div className="mt-6">
          {request.has_responder ? (
            <>
              <h2 className="font-display text-sm font-semibold text-paper">
                Chat with {request.responder_name ?? 'your responder'}
              </h2>
              <div className="mt-2">
                <RequestChat requestId={request.id} senderType="reporter" responderName={request.responder_name ?? undefined} />
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-hairline bg-panel p-4 text-sm text-muted">
              You'll be able to message your responder here once someone is assigned to your request.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
