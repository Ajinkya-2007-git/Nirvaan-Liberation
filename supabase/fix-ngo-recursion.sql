-- ============================================================
-- FIX: INFINITE RECURSION IN NGO STATUS POLICY
-- ============================================================
-- The old "owners can update own ngo details" policy checked
-- "status = (select status from ngos where id = auth.uid())" —
-- a policy ON ngos querying ngos AGAIN. Postgres has to apply RLS
-- to that inner query too, which re-runs the same policy, which
-- queries ngos again... forever. That's the recursion error.
--
-- The fix: stop trying to protect the status column through RLS at
-- all. Instead, a plain database trigger silently resets status
-- back to whatever it already was, unless the person making the
-- change is an admin. Triggers don't have this self-reference
-- problem because they run as a separate step, not as part of the
-- permission check itself.
-- ============================================================

-- Replace the old self-referencing policy with a simple one: an
-- owner can update their own row, full stop. The trigger below is
-- what actually protects the status column, not this policy.
drop policy if exists "owners can update own ngo details" on ngos;
create policy "owners can update own ngo details"
  on ngos for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- This function runs automatically right before any update to a
-- ngos row. It checks profiles (a DIFFERENT table, so no
-- recursion) — if the person making the change isn't an admin,
-- their attempted new status is silently thrown away and the old
-- one kept instead.
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
