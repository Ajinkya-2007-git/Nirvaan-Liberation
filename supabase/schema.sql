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
