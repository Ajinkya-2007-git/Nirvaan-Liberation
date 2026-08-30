-- ============================================================
-- NGO CONTACT FIELD + ADMIN VISIBILITY
-- ============================================================
-- Two separate problems this fixes:
--
-- 1. Same issue as volunteers: profiles.phone is only visible to
--    its own owner (see "users can view own profile" in
--    schema.sql). An admin reviewing a pending NGO application
--    needs to see a contact number — so we duplicate it onto the
--    ngos row itself, same pattern as
--    add-volunteer-contact-fields.sql.
--
-- 2. A policy gap: schema.sql already lets admins UPDATE any ngos
--    row (to approve/reject), but never explicitly let them SELECT
--    pending or rejected rows in the first place — Postgres treats
--    SELECT and UPDATE as separate permissions, so having one does
--    not imply the other. Without this, the admin panel's approval
--    queue would come back completely empty.
-- ============================================================

alter table ngos add column contact_phone text;

create policy "admins can view all ngos"
  on ngos for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
