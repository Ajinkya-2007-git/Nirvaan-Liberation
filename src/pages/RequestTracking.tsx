// The reporter's own page for their request, opened from the link on the
// confirmation screen. No login: the request's unguessable id is the access key.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Header } from '../components/Header';
import { RequestChat } from '../components/RequestChat';
import type { SosRequest } from '../lib/types';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Waiting for a responder',
  assigned: 'A responder has been assigned',
  en_route: 'Help is on the way',
  resolved: 'Resolved',
};

export function RequestTracking() {
  const { requestId } = useParams<{ requestId: string }>();
  const [request, setRequest] = useState<SosRequest | null>(null);
  const [responderName, setResponderName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!requestId) return;

    async function load() {
      const { data, error } = await supabase.from('sos_requests').select('*').eq('id', requestId).single();
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setRequest(data);

      // Look up just the responder's NAME, to show who the reporter is chatting with.
      if (data.assigned_responder_id && data.assigned_responder_type === 'volunteer') {
        const { data: v } = await supabase
          .from('volunteer_profiles')
          .select('full_name')
          .eq('id', data.assigned_responder_id)
          .maybeSingle();
        setResponderName(v?.full_name ?? 'Volunteer');
      } else if (data.assigned_responder_id && data.assigned_responder_type === 'ngo') {
        const { data: n } = await supabase.from('ngos').select('org_name').eq('id', data.assigned_responder_id).maybeSingle();
        setResponderName(n?.org_name ?? 'NGO');
      }
      setLoading(false);
    }
    load();

    // Live status changes (assigned -> en route -> resolved) without reloading.
    const channel = supabase
      .channel(`track-${requestId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sos_requests', filter: `id=eq.${requestId}` },
        (payload) => setRequest(payload.new as SosRequest)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

        <div className="mt-4 rounded-lg border border-hairline bg-panel p-4">
          <p className="text-sm font-semibold text-signal">{STATUS_LABEL[request.status]}</p>
          <p className="mt-2 text-sm text-paper">{request.description}</p>
        </div>

        <div className="mt-6">
          {request.assigned_responder_id ? (
            <>
              <h2 className="font-display text-sm font-semibold text-paper">Chat with {responderName ?? 'your responder'}</h2>
              <div className="mt-2">
                <RequestChat requestId={request.id} senderType="reporter" responderName={responderName ?? undefined} />
              </div>
            </>
          ) : (
            <p className="rounded-lg border border-hairline bg-panel p-4 text-sm text-muted">
              You'll be able to message your responder here once someone is assigned to your request.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
