-- ============================================================
-- NGO AREA ASSIGNMENTS
-- ============================================================
-- Lets an admin say "this NGO covers this radius around their base,
-- focused on this category" — so that when multiple requests come
-- in from the same neighborhood, they all point back to ONE
-- responsible NGO instead of several different NGOs converging on
-- the same street. This is a separate table from an individual
-- request assignment (see the "assignments" table) — an area
-- assignment is a standing responsibility, not a one-off task.
-- ============================================================

create table ngo_area_assignments (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references ngos(id) on delete cascade,

  -- Deliberately just latitude/longitude + a radius, not a hand-
  -- drawn polygon — a circle is enough to express "the area around
  -- X" clearly, and is far simpler to both create (a single radius
  -- input) and render (a single Leaflet Circle) than a full
  -- geofencing system would be.
  center_lat double precision not null,
  center_lng double precision not null,
  radius_km numeric not null,

  -- Optional — null means "any category," a filled-in value means
  -- "this NGO is specifically focused on medical/food/shelter/rescue
  -- requests in this area," per the admin's own judgment about
  -- what's most needed there.
  category text check (category in ('medical', 'food', 'shelter', 'rescue') or category is null),

  created_at timestamptz not null default now()
);

alter table ngo_area_assignments enable row level security;
grant select, insert, update, delete on ngo_area_assignments to anon, authenticated;

-- Anyone can see area assignments — same transparency pattern as
-- every other piece of the live map (requests, volunteers, NGOs).
-- This is what lets the circle actually render on both the public
-- map and the NGO's own view.
create policy "anyone can view ngo area assignments"
  on ngo_area_assignments for select
  using (true);

-- Only an admin can CREATE one — enforced here at the database
-- level, not just by which button happens to be visible in the UI.
create policy "admins can create area assignments"
  on ngo_area_assignments for insert
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
