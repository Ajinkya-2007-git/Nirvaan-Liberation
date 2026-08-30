-- ============================================================
-- TABLE GRANTS
-- ============================================================
-- Postgres has TWO separate security layers, not one:
--   1. GRANTs — a basic on/off switch: is this role even allowed
--      to touch this table at all?
--   2. RLS policies (already in schema.sql) — once inside, which
--      SPECIFIC ROWS can it see or change?
--
-- We already wrote the RLS policies correctly. This file makes
-- sure the front door (GRANTs) is actually open for our two
-- Supabase login roles:
--   "anon"          = anyone not logged in (e.g. submitting an SOS)
--   "authenticated" = anyone logged in (volunteers, NGOs, admins)
--
-- Run this in the SQL Editor the same way you ran schema.sql.
-- ============================================================

-- Lets these roles even "enter the room" where our tables live.
grant usage on schema public to anon, authenticated;

-- Lets these roles run select/insert/update/delete on each table.
-- Remember: RLS policies still apply on TOP of this — a grant
-- alone does not bypass row-level security, it just stops Postgres
-- from blocking the request before RLS even gets a chance to run.
grant select, insert, update, delete on profiles to anon, authenticated;
grant select, insert, update, delete on volunteer_profiles to anon, authenticated;
grant select, insert, update, delete on ngos to anon, authenticated;
grant select, insert, update, delete on sos_requests to anon, authenticated;
grant select, insert, update, delete on assignments to anon, authenticated;
