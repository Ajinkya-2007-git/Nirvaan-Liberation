-- ============================================================
-- ADD CONTACT FIELDS TO volunteer_profiles
-- ============================================================
-- Why: the map needs to show a volunteer's name/phone to whoever
-- is deciding who to assign an SOS to. Our "profiles" table (where
-- names actually live) only allows people to view their OWN row —
-- that's the right call for privacy in general, but it means the
-- map can't just casually join against it.
--
-- Rather than loosening profiles' security rules for everyone,
-- we duplicate just the name/phone onto volunteer_profiles, which
-- is ALREADY safely public for available volunteers (see the
-- "anyone can view available volunteers" policy in schema.sql).
-- A little data duplication here is a simpler, safer trade than a
-- more permissive security rule.
-- ============================================================

alter table volunteer_profiles add column full_name text;
alter table volunteer_profiles add column phone text;
