-- ============================================================
-- NIRVAAN DATABASE SCHEMA (v2)
-- ============================================================
-- This file creates every table our app needs, plus the security
-- rules ("Row Level Security" / RLS) that control who can see and
-- change what data.
--
-- HOW TO USE THIS FILE:
-- 1. Go to supabase.com, create a free account and a new project.
-- 2. In your Supabase project, open the "SQL Editor" tab.
-- 3. Paste this entire file in and click "Run".
-- ============================================================


-- ------------------------------------------------------------
-- TABLE 1: profiles
-- ------------------------------------------------------------
-- Supabase has a hidden built-in table "auth.users" that stores
-- login info (email, password hash). We can't add columns to it
-- directly, so we make our OWN table linked to it 1-to-1.
-- This table is ONLY for people who actually log in: volunteers,
-- NGOs, and admins. People submitting an SOS do NOT need one.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,

  -- What kind of logged-in user this is. "user" here just means
  -- someone with an account who isn't a volunteer/ngo/admin yet.
  role text not null default 'user'
    check (role in ('user', 'volunteer', 'ngo_admin', 'admin')),

  preferred_language text not null default 'en',
  created_at timestamptz not null default now()
);


-- ------------------------------------------------------------
-- TABLE 2: volunteer_profiles
-- ------------------------------------------------------------
-- Extra details ONLY volunteers need. Kept separate from
-- "profiles" so that table doesn't get cluttered with columns
-- that don't apply to NGOs or admins.
create table volunteer_profiles (
  -- Same id as their profiles row and their auth.users row —
  -- this is what "extends" means here, it's the same person.
  id uuid primary key references profiles(id) on delete cascade,

  -- Duplicated from "profiles" on purpose — see
  -- add-volunteer-contact-fields.sql for why. This is what the
  -- live map shows when someone views this volunteer's pin.
  full_name text,
  phone text,

  -- A single volunteer, or someone signing up on behalf of a
  -- whole team (e.g. a college NSS unit doing rescue work).
  signup_type text not null default 'individual'
    check (signup_type in ('individual', 'group')),

  -- Only filled in when signup_type = 'group'. NULL for individuals.
  member_count integer,

  -- What kind of help this volunteer/group can give. Stored as a
  -- text array so one person can have multiple skills, e.g.
  -- {'medical', 'boat'}.
  skills text[] not null default '{}',

  -- Last known location, captured via the browser's Geolocation API.
  latitude double precision,
  longitude double precision,

  -- Toggle the volunteer flips themselves — "I'm free to help right
  -- now" vs "don't send me anything, I'm already busy."
  available boolean not null default true,

  updated_at timestamptz not null default now()
);


-- ------------------------------------------------------------
-- TABLE 3: ngos
-- ------------------------------------------------------------
create table ngos (
  id uuid primary key references profiles(id) on delete cascade,
  org_name text not null,
  registration_number text,
  area_of_operation text,
  resources_available text,

  -- Duplicated from "profiles" on purpose, same reasoning as
  -- volunteer_profiles.full_name/phone: profiles' own RLS only
  -- lets someone see their OWN row, which would otherwise block
  -- an admin from seeing this NGO's contact info while reviewing
  -- their application.
  contact_phone text,

  latitude double precision,
  longitude double precision,

  -- Three clear states instead of a plain true/false, so we can
  -- show the NGO a real message like "under review" vs "rejected"
  -- instead of just a blank/blocked screen.
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'rejected')),

  created_at timestamptz not null default now()
);


-- ------------------------------------------------------------
-- TABLE 4: sos_requests
-- ------------------------------------------------------------
-- THE most important table. Deliberately does NOT require a
-- logged-in user — reporter details are just stored as plain text
-- on the row itself, because someone in a real emergency should
-- never be blocked by a signup screen.
create table sos_requests (
  id uuid primary key default gen_random_uuid(),

  -- Who is reporting this (may not be the person in danger —
  -- could be a neighbour or relative calling it in for someone else).
  -- Nullable because the one-tap "Quick SOS" button collects no
  -- reporter details at all — only the full Request Help form
  -- actually requires these (enforced in that form, not here).
  reporter_name text,
  reporter_phone text,
  relationship text not null default 'self'
    check (relationship in ('self', 'relative', 'neighbor', 'other')),

  -- Where the person in need actually is
  latitude double precision not null,
  longitude double precision not null,
  landmark text,  -- fallback description, since addresses are often unreliable in a disaster

  description text not null,

  -- Filled in automatically by our AI classification edge function
  category text
    check (category in ('medical', 'food', 'shelter', 'rescue') or category is null),
  urgency text
    check (urgency in ('critical', 'high', 'medium', 'low') or urgency is null),

  status text not null default 'pending'
    check (status in ('pending', 'assigned', 'en_route', 'resolved')),

  -- Denormalized "who's currently on this" fields, so the map/list
  -- can show assignment status without an extra database join.
  assigned_responder_id uuid references profiles(id),
  assigned_responder_type text
    check (assigned_responder_type in ('volunteer', 'ngo') or assigned_responder_type is null),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ------------------------------------------------------------
-- TABLE 5: assignments
-- ------------------------------------------------------------
-- A permanent history log: every time someone gets assigned to a
-- request, we record it here — even if they're later reassigned.
-- sos_requests only shows the CURRENT assignment; this table shows
-- the full timeline, useful for both the admin panel and your pitch
-- ("here's proof the matching actually happened").
create table assignments (
  id uuid primary key default gen_random_uuid(),
  sos_request_id uuid not null references sos_requests(id) on delete cascade,
  responder_id uuid not null references profiles(id),
  responder_type text not null check (responder_type in ('volunteer', 'ngo')),
  assigned_at timestamptz not null default now(),
  resolved_at timestamptz
);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Once RLS is on for a table, EVERYONE is blocked from
-- EVERYTHING until a policy explicitly allows it. Deny by
-- default is the safest way to build anything handling
-- emergency data.
-- ============================================================

alter table profiles enable row level security;
alter table volunteer_profiles enable row level security;
alter table ngos enable row level security;
alter table sos_requests enable row level security;
alter table assignments enable row level security;


-- --- profiles ---
create policy "users can view own profile" on profiles for select using (auth.uid() = id);
create policy "users can update own profile" on profiles for update using (auth.uid() = id);
create policy "users can insert own profile" on profiles for insert with check (auth.uid() = id);


-- --- volunteer_profiles ---
create policy "volunteers can manage own profile"
  on volunteer_profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- Anyone can VIEW available volunteers — this is what puts blue
-- pins on the public map. They still can't edit anyone else's row.
create policy "anyone can view available volunteers"
  on volunteer_profiles for select
  using (available = true);


-- --- ngos ---
create policy "anyone can view approved ngos" on ngos for select using (status = 'approved');
create policy "owners can view own ngo" on ngos for select using (auth.uid() = id);
-- Without this, an admin's SELECT query for pending NGOs silently
-- returns zero rows instead of an error — RLS just filters them
-- out, so it can look like a display bug when it's really a missing
-- permission. See admin-can-view-ngos.sql for how this was found.
create policy "admins can view all ngos"
  on ngos for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
-- Deliberately simple — NOT self-referencing. See
-- fix-ngo-recursion.sql for why an earlier version of this policy
-- (which checked ngos from within a policy ON ngos) caused an
-- infinite recursion error. The status column is protected by the
-- ngo_status_guard TRIGGER below instead, not by this policy.
create policy "owners can update own ngo details"
  on ngos for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
create policy "users can submit ngo application" on ngos for insert with check (auth.uid() = id);

-- Only a logged-in admin can approve/reject an NGO.
create policy "admins can update ngo status"
  on ngos for update
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

-- Postgres treats SELECT and UPDATE as separate permissions — being
-- allowed to update a row doesn't imply being allowed to see it in
-- the first place. Without this, the admin approval queue would
-- come back empty, since pending/rejected NGOs are otherwise only
-- visible to their own owner.
create policy "admins can view all ngos"
  on ngos for select
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));


-- --- sos_requests ---
-- No login required to report an emergency — "true" means this
-- check never blocks anyone, logged in or not.
create policy "anyone can submit an sos request"
  on sos_requests for insert
  with check (true);

-- Anyone can also VIEW requests — this is what makes the live map
-- public. (If you later want to hide reporter phone numbers from
-- the public, that's done by only selecting safe columns in the
-- frontend query, not by blocking the row entirely.)
create policy "anyone can view sos requests"
  on sos_requests for select
  using (true);

-- Only logged-in volunteers/ngo_admins/admins can update a
-- request (e.g. to assign themselves or mark it resolved).
create policy "responders can update sos requests"
  on sos_requests for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('volunteer', 'ngo_admin', 'admin')
    )
  );


-- --- assignments ---
create policy "responders can create assignments"
  on assignments for insert
  with check (auth.uid() = responder_id);

create policy "anyone can view assignments"
  on assignments for select
  using (true);


-- ============================================================
-- TABLE GRANTS
-- ============================================================
-- RLS policies alone aren't enough — Postgres also needs a basic
-- "is this role allowed to touch this table at all" permission.
-- We ran into this the hard way, so it's folded into the main
-- schema file now for anyone setting this project up fresh.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on profiles to anon, authenticated;
grant select, insert, update, delete on volunteer_profiles to anon, authenticated;
grant select, insert, update, delete on ngos to anon, authenticated;
grant select, insert, update, delete on sos_requests to anon, authenticated;
grant select, insert, update, delete on assignments to anon, authenticated;


-- ============================================================
-- PROTECT THE NGO STATUS COLUMN VIA TRIGGER, NOT RLS
-- ============================================================
-- Runs before any update to a ngos row. Checks profiles (a
-- DIFFERENT table — no self-reference, no recursion risk) and
-- silently keeps the old status unless the person making the
-- change is an admin.
create or replace function public.prevent_ngo_self_approval()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    new.status := old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists ngo_status_guard on ngos;
create trigger ngo_status_guard
  before update on ngos
  for each row execute function public.prevent_ngo_self_approval();


-- ============================================================
-- NGO AREA ASSIGNMENTS
-- ============================================================
-- Lets an admin assign an NGO responsibility for a radius around
-- their base, optionally focused on one category — so multiple
-- requests from the same area point back to one responsible NGO
-- instead of several NGOs converging on the same street.
create table ngo_area_assignments (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references ngos(id) on delete cascade,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_km numeric not null,
  -- A human label (e.g. "Sama - Savli Road") so an area is
  -- recognizable at a glance instead of just coordinates.
  area_name text,
  -- Combines with "category" below — an admin can narrow an area
  -- assignment to a specific urgency, a specific category, both, or
  -- neither (fully open).
  urgency text check (urgency in ('critical', 'high', 'medium', 'low') or urgency is null),
  category text check (category in ('medical', 'food', 'shelter', 'rescue') or category is null),
  created_at timestamptz not null default now()
);

alter table ngo_area_assignments enable row level security;
grant select, insert, update, delete on ngo_area_assignments to anon, authenticated;

create policy "anyone can view ngo area assignments"
  on ngo_area_assignments for select
  using (true);

create policy "admins can create area assignments"
  on ngo_area_assignments for insert
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- ===== REQUEST MESSAGES =====
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

-- ===== AREA FULFILLMENT =====
-- AREA FULFILLMENT: an NGO can report it only partly covered its area; an admin
-- can then reassign it. Old assignment becomes 'reassigned' (hidden from the map).
alter table ngo_area_assignments add column status text not null default 'active'
  check (status in ('active', 'partially_fulfilled', 'reassigned'));
alter table ngo_area_assignments add column notes text;
alter table ngo_area_assignments add column superseded_by uuid references ngo_area_assignments(id);

create policy "assigned ngo can update own area assignment"
  on ngo_area_assignments for update
  using (auth.uid() = ngo_id) with check (auth.uid() = ngo_id);

create policy "admins can update any area assignment"
  on ngo_area_assignments for update
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

-- Column-level protection (policies only limit ROWS): a non-admin may only move
-- status to 'partially_fulfilled' and edit notes; everything else reverts.
create or replace function public.guard_area_assignment_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    new.ngo_id := old.ngo_id;
    new.center_lat := old.center_lat;
    new.center_lng := old.center_lng;
    new.radius_km := old.radius_km;
    new.area_name := old.area_name;
    new.category := old.category;
    new.urgency := old.urgency;
    new.superseded_by := old.superseded_by;
    if new.status <> 'partially_fulfilled' then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists area_assignment_update_guard on ngo_area_assignments;
create trigger area_assignment_update_guard
  before update on ngo_area_assignments
  for each row execute function public.guard_area_assignment_update();

-- ===== SECURITY HARDENING (final section: replaces the looser policies above) =====
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
