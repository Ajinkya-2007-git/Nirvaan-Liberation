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
