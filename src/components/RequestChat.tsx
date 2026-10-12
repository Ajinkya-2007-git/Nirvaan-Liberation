// Real-time two-way chat for one SOS request. Used by the reporter (no login,
// RequestTracking.tsx) and by the assigned responder (Map.tsx assignments panel).
// Same component on both sides, so both always see the same conversation.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { timeAgo } from '../lib/timeAgo';
import type { RequestMessage } from '../lib/types';

interface RequestChatProps {
  requestId: string;
  senderType: 'reporter' | 'responder';
  // Only sent for responders; the database checks it against the request's real assigned responder.
  senderId?: string;
  responderName?: string;
}

export function RequestChat({ requestId, senderType, senderId, responderName }: RequestChatProps) {
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null); // used to auto-scroll to the newest message

  useEffect(() => {
    async function loadMessages() {
      const { data } = await supabase
        .from('request_messages')
        .select('*')
        .eq('sos_request_id', requestId)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
      setLoading(false);
    }
    loadMessages();

    // Live updates: new messages from the other side appear without refreshing.
    const channel = supabase
      .channel(`request-chat-${requestId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'request_messages', filter: `sos_request_id=eq.${requestId}` },
        (payload) => setMessages((current) => [...current, payload.new as RequestMessage])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError('');

    const { error: insertError } = await supabase.from('request_messages').insert({
      sos_request_id: requestId,
      sender_type: senderType,
      sender_id: senderType === 'responder' ? senderId : null,
      message: draft.trim(),
    });

    setSending(false);
    if (insertError) {
      setError('Could not send. Please try again.');
      return;
    }
    // Not added to local state here: the live subscription above delivers it back
    // (adding it twice would briefly show a duplicate).
    setDraft('');
  }

  return (
    <div className="flex h-80 flex-col rounded-lg border border-hairline bg-ink">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {loading && <p className="text-center text-xs text-muted">Loading messages...</p>}
        {!loading && messages.length === 0 && <p className="text-center text-xs text-muted">No messages yet — say hello.</p>}

        {messages.map((m) => {
          // "Mine" is relative to whoever is viewing: the same stored message is
          // right-aligned for its sender and left-aligned for the other person.
          const isMe = m.sender_type === senderType;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
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
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-md border border-hairline bg-panel px-3 py-1.5 text-sm text-paper"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="rounded-md bg-signal px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          Send
        </button>
      </form>
      {error && <p className="px-3 pb-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
