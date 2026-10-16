-- ============================================================================
-- SECURITY HARDENING  (run once in the Supabase SQL Editor; safe to re-run)
-- ============================================================================
-- Fixes found in the audit:
--  1. Anyone could become an ADMIN: the sign-up trigger trusted a "role" sent by the browser,
--     and users could edit their own role.
--  2. Anyone could insert their own NGO already "approved".
--  3. Any volunteer could edit ANY request (reporter phone, status, urgency, assignee).
--  4. Reporter phone numbers and exact locations were readable by anyone calling the API.
--  5. The "assignments" history never saved (admins weren't allowed to write it), so the
--     Impact numbers had nothing to calculate from. Assign/resolve times now live on the request.
--  6. Anonymous visitors could write directly into requests (status/assignee) and chats.
-- ============================================================================

-- ---------- Helper functions (used by the policies below) ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Who may see live requests, volunteers, NGOs and areas: admins, volunteers, and APPROVED NGOs.
create or replace function public.can_view_live_data()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'volunteer')
        or (p.role = 'ngo_admin' and exists (select 1 from public.ngos n where n.id = p.id and n.status = 'approved'))
      )
  );
$$;

create or replace function public.is_assigned_responder(p_request_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sos_requests r where r.id = p_request_id and r.assigned_responder_id = auth.uid());
$$;

grant execute on function public.is_admin(), public.can_view_live_data(), public.is_assigned_responder(uuid) to anon, authenticated;

-- ---------- 1. Roles can no longer be chosen or edited by users ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
    left(new.raw_user_meta_data->>'phone', 30),
    -- Only the two public sign-up roles are accepted. "admin" can never come from the browser.
    case when requested_role in ('volunteer', 'ngo_admin') then requested_role else 'user' end
  );
  return new;
end;
$$;

-- Role/id on a profile can only be changed from the Supabase dashboard (where auth.uid() is null).
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.role := old.role;
    new.id := old.id;
  end if;
  return new;
end;
$$;
drop trigger if exists profile_update_guard on public.profiles;
create trigger profile_update_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- Profiles are created only by the sign-up trigger, never by the browser.
drop policy if exists "users can insert own profile" on public.profiles;

-- ---------- 2. NGOs always start as pending ----------
create or replace function public.force_ngo_pending_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    new.status := 'pending_approval';
  end if;
  return new;
end;
$$;
drop trigger if exists ngo_insert_guard on public.ngos;
create trigger ngo_insert_guard before insert on public.ngos
  for each row execute function public.force_ngo_pending_on_insert();

drop policy if exists "anyone can view approved ngos" on public.ngos;
drop policy if exists "live data viewers can view approved ngos" on public.ngos;
create policy "live data viewers can view approved ngos" on public.ngos
  for select to authenticated using (status = 'approved' and public.can_view_live_data());

-- ---------- 3 + 6. Requests: strict insert, restricted view, guarded updates ----------
alter table public.sos_requests add column if not exists assigned_at timestamptz;
alter table public.sos_requests add column if not exists resolved_at timestamptz;

drop policy if exists "anyone can submit an sos request" on public.sos_requests;
create policy "anyone can submit an sos request" on public.sos_requests
  for insert to anon, authenticated
  with check (status = 'pending' and assigned_responder_id is null and assigned_responder_type is null);

drop policy if exists "anyone can view sos requests" on public.sos_requests;
drop policy if exists "live data viewers can view sos requests" on public.sos_requests;
create policy "live data viewers can view sos requests" on public.sos_requests
  for select to authenticated using (public.can_view_live_data());

drop policy if exists "responders can update sos requests" on public.sos_requests;
drop policy if exists "admins and the assigned responder can update requests" on public.sos_requests;
create policy "admins and the assigned responder can update requests" on public.sos_requests
  for update to authenticated
  using (public.is_admin() or assigned_responder_id = auth.uid())
  with check (public.is_admin() or assigned_responder_id = auth.uid());

-- Policies limit which ROWS can change; this trigger limits which COLUMNS. A responder who
-- isn't an admin can only move their own request forward (assigned -> en route -> resolved).
-- It also stamps assigned_at / resolved_at on the server, so the Impact numbers can be trusted.
create or replace function public.guard_sos_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  privileged boolean := auth.uid() is null or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
begin
  if not privileged then
    new.id := old.id;
    new.reporter_name := old.reporter_name;
    new.reporter_phone := old.reporter_phone;
    new.relationship := old.relationship;
    new.latitude := old.latitude;
    new.longitude := old.longitude;
    new.landmark := old.landmark;
    new.description := old.description;
    new.category := old.category;
    new.urgency := old.urgency;
    new.assigned_responder_id := old.assigned_responder_id;
    new.assigned_responder_type := old.assigned_responder_type;
    new.created_at := old.created_at;
    new.assigned_at := old.assigned_at;
    new.resolved_at := old.resolved_at;
    if not (
      new.status = old.status
      or (old.status = 'assigned' and new.status in ('en_route', 'resolved'))
      or (old.status = 'en_route' and new.status = 'resolved')
    ) then
      new.status := old.status;
    end if;
  end if;

  if new.assigned_responder_id is not null and old.assigned_responder_id is null then
    new.assigned_at := now();
  end if;
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists sos_update_guard on public.sos_requests;
create trigger sos_update_guard before update on public.sos_requests
  for each row execute function public.guard_sos_update();

-- Fill in times for requests that were handled before these columns existed (best estimate).
update public.sos_requests set assigned_at = updated_at where assigned_responder_id is not null and assigned_at is null;
update public.sos_requests set resolved_at = updated_at where status = 'resolved' and resolved_at is null;

-- Size limits (NOT VALID = enforced for new rows without failing on old ones).
alter table public.sos_requests drop constraint if exists sos_requests_size_limits;
alter table public.sos_requests add constraint sos_requests_size_limits check (
  char_length(description) between 1 and 2000
  and (reporter_name is null or char_length(reporter_name) <= 120)
  and (reporter_phone is null or char_length(reporter_phone) <= 30)
  and (landmark is null or char_length(landmark) <= 300)
  and latitude between -90 and 90
  and longitude between -180 and 180
) not valid;

-- ---------- 4. Volunteers: visible only to people allowed to see live data ----------
drop policy if exists "anyone can view available volunteers" on public.volunteer_profiles;
drop policy if exists "live data viewers can view available volunteers" on public.volunteer_profiles;
create policy "live data viewers can view available volunteers" on public.volunteer_profiles
  for select to authenticated using (available = true and public.can_view_live_data());

-- ---------- 5. Assignment history: admins write it, the responder + admins read it ----------
drop policy if exists "responders can create assignments" on public.assignments;
drop policy if exists "anyone can view assignments" on public.assignments;
drop policy if exists "admins can create assignments" on public.assignments;
drop policy if exists "admins and the responder can view assignments" on public.assignments;
create policy "admins can create assignments" on public.assignments
  for insert to authenticated with check (public.is_admin());
create policy "admins and the responder can view assignments" on public.assignments
  for select to authenticated using (public.is_admin() or responder_id = auth.uid());

-- ---------- Area allocations (only if that migration was run) ----------
do $$
begin
  if to_regclass('public.ngo_area_assignments') is not null then
    drop policy if exists "anyone can view ngo area assignments" on public.ngo_area_assignments;
    drop policy if exists "live data viewers can view area assignments" on public.ngo_area_assignments;
    create policy "live data viewers can view area assignments" on public.ngo_area_assignments
      for select to authenticated using (public.can_view_live_data());
  end if;
end $$;

-- ---------- Chat (only if that migration was run) ----------
do $$
begin
  if to_regclass('public.request_messages') is not null then
    drop policy if exists "anyone can view messages for a request" on public.request_messages;
    drop policy if exists "anyone can send a message as reporter" on public.request_messages;
    drop policy if exists "assigned responder can send a message" on public.request_messages;
    drop policy if exists "admins and the assigned responder can view messages" on public.request_messages;

    create policy "admins and the assigned responder can view messages" on public.request_messages
      for select to authenticated
      using (public.is_admin() or public.is_assigned_responder(sos_request_id));

    create policy "assigned responder can send a message" on public.request_messages
      for insert to authenticated
      with check (sender_type = 'responder' and sender_id = auth.uid() and public.is_assigned_responder(sos_request_id));

    alter table public.request_messages drop constraint if exists request_messages_size_limit;
    alter table public.request_messages add constraint request_messages_size_limit
      check (char_length(message) between 1 and 1000) not valid;
  end if;
end $$;

-- ---------- What a reporter (no account) is allowed to do: three narrow, safe functions ----------
-- They need the request's own unguessable id, and return only what the reporter should see
-- (never phone numbers, never other people's requests).
create or replace function public.get_request_tracking(p_request_id uuid)
returns table (
  id uuid, status text, description text, assigned_responder_type text,
  has_responder boolean, responder_name text, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    r.id, r.status::text, r.description, r.assigned_responder_type::text,
    r.assigned_responder_id is not null,
    case r.assigned_responder_type
      when 'volunteer' then (select v.full_name from public.volunteer_profiles v where v.id = r.assigned_responder_id)
      when 'ngo' then (select n.org_name from public.ngos n where n.id = r.assigned_responder_id)
    end,
    r.created_at, r.updated_at
  from public.sos_requests r
  where r.id = p_request_id;
$$;

create or replace function public.get_request_messages(p_request_id uuid)
returns table (id uuid, sender_type text, message text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.sender_type::text, m.message, m.created_at
  from public.request_messages m
  where m.sos_request_id = p_request_id
  order by m.created_at asc;
$$;

create or replace function public.send_reporter_message(p_request_id uuid, p_message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_message is null or char_length(btrim(p_message)) = 0 or char_length(p_message) > 1000 then
    raise exception 'invalid message';
  end if;
  if not exists (select 1 from public.sos_requests where id = p_request_id and assigned_responder_id is not null) then
    raise exception 'chat not available';
  end if;
  -- Simple spam brake: at most 15 messages a minute per request.
  if (select count(*) from public.request_messages
      where sos_request_id = p_request_id and sender_type = 'reporter' and created_at > now() - interval '1 minute') >= 15 then
    raise exception 'too many messages';
  end if;
  insert into public.request_messages (sos_request_id, sender_type, sender_id, message)
  values (p_request_id, 'reporter', null, btrim(p_message));
end;
$$;

grant execute on function public.get_request_tracking(uuid), public.get_request_messages(uuid),
  public.send_reporter_message(uuid, text) to anon, authenticated;

-- ---------- Least privilege: strip table rights nobody needs ----------
-- Anonymous visitors may only INSERT a request. Nobody needs delete/truncate from the browser.
revoke all on all tables in schema public from anon;
grant insert on public.sos_requests to anon;
revoke delete, truncate, references, trigger on all tables in schema public from authenticated;

notify pgrst, 'reload schema';
