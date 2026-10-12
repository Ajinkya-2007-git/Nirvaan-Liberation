-- REQUEST MESSAGES: one chat thread per SOS request, between the (usually
-- account-less) reporter and the assigned responder. The request's own
-- unguessable id acts as the access key for the reporter, same model as the
-- rest of the app. Only the genuinely assigned responder can post as "responder".
create table request_messages (
  id uuid primary key default gen_random_uuid(),
  sos_request_id uuid not null references sos_requests(id) on delete cascade,
  sender_type text not null check (sender_type in ('reporter', 'responder')),
  sender_id uuid references profiles(id),
  message text not null,
  created_at timestamptz not null default now()
);

alter table request_messages enable row level security;
grant select, insert on request_messages to anon, authenticated;

create policy "anyone can view messages for a request"
  on request_messages for select using (true);

create policy "anyone can send a message as reporter"
  on request_messages for insert
  with check (sender_type = 'reporter' and sender_id is null);

create policy "assigned responder can send a message"
  on request_messages for insert
  with check (
    sender_type = 'responder'
    and sender_id = auth.uid()
    and exists (
      select 1 from sos_requests
      where sos_requests.id = sos_request_id
      and sos_requests.assigned_responder_id = auth.uid()
    )
  );

alter publication supabase_realtime add table request_messages;
