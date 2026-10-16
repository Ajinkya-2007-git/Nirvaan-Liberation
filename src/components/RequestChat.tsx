// Two-way chat for one SOS request. Same component on both sides:
//  - the reporter (no account) reads and writes through narrow database functions and the
//    thread refreshes every few seconds;
//  - the assigned responder / admin reads the table directly (protected by row-level rules)
//    and gets messages live.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { timeAgo } from '../lib/timeAgo';
import type { RequestMessage } from '../lib/types';

interface RequestChatProps {
  requestId: string;
  senderType: 'reporter' | 'responder';
  // Only for responders; the database checks it against the request's real assigned responder.
  senderId?: string;
  responderName?: string;
}

export function RequestChat({ requestId, senderType, senderId, responderName }: RequestChatProps) {
  const isReporter = senderType === 'reporter';
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Replaces the list only if something actually changed, so the view doesn't jump around.
  const applyMessages = useCallback((next: RequestMessage[]) => {
    setMessages((current) =>
      current.length === next.length && current[current.length - 1]?.id === next[next.length - 1]?.id ? current : next
    );
  }, []);

  const load = useCallback(async () => {
    if (isReporter) {
      const { data } = await supabase.rpc('get_request_messages', { p_request_id: requestId });
      if (data) {
        applyMessages(
          (data as { id: string; sender_type: 'reporter' | 'responder'; message: string; created_at: string }[]).map((m) => ({
            ...m,
            sos_request_id: requestId,
          }))
        );
      }
    } else {
      const { data } = await supabase
        .from('request_messages')
        .select('*')
        .eq('sos_request_id', requestId)
        .order('created_at', { ascending: true });
      if (data) applyMessages(data);
    }
    setLoading(false);
  }, [isReporter, requestId, applyMessages]);

  useEffect(() => {
    void load();

    if (isReporter) {
      // No account means no live feed, so check for replies every few seconds.
      const timer = setInterval(load, 4000);
      return () => clearInterval(timer);
    }

    // Responders get new messages instantly.
    const channel = supabase
      .channel(`request-chat-${requestId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'request_messages', filter: `sos_request_id=eq.${requestId}` },
        (payload) => {
          const incoming = payload.new as RequestMessage;
          setMessages((current) => (current.some((m) => m.id === incoming.id) ? current : [...current, incoming]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isReporter, requestId, load]);

  // Keep the newest message in view (only when the NUMBER of messages changes).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setSending(true);
    setError('');

    const { error: sendError } = isReporter
      ? await supabase.rpc('send_reporter_message', { p_request_id: requestId, p_message: text })
      : await supabase.from('request_messages').insert({
          sos_request_id: requestId,
          sender_type: 'responder',
          sender_id: senderId,
          message: text,
        });

    setSending(false);
    if (sendError) {
      setError('Could not send. Please try again.');
      return;
    }
    setDraft('');
    // The reporter has no live feed, so fetch right away to show their own message.
    if (isReporter) await load();
  }

  return (
    <div className="flex h-80 flex-col rounded-xl border border-hairline bg-ink">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {loading && <p className="text-center text-xs text-muted">Loading messages...</p>}
        {!loading && messages.length === 0 && <p className="text-center text-xs text-muted">No messages yet — say hello.</p>}

        {messages.map((m) => {
          // "Mine" is relative to whoever is viewing: right-aligned for the sender, left for the other side.
          const isMe = m.sender_type === senderType;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] break-words rounded-xl px-3 py-2 text-sm ${
                  isMe ? 'bg-signal text-white' : 'border border-hairline bg-panel text-paper'
                }`}
              >
                <p>{m.message}</p>
                <p className={`mt-1 text-[10px] ${isMe ? 'text-white/70' : 'text-muted'}`}>
                  {!isMe && m.sender_type === 'responder' && responderName ? `${responderName} · ` : ''}
                  {timeAgo(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-hairline p-2">
        <input
          type="text"
          value={draft}
          maxLength={1000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          className="min-h-10 flex-1 rounded-lg border border-hairline bg-panel px-3 text-sm text-paper"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="min-h-10 rounded-lg bg-signal px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          Send
        </button>
      </form>
      {error && <p className="px-3 pb-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
