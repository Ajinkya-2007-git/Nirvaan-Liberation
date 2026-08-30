-- ============================================================
-- ADD AREA NAME + URGENCY TO NGO AREA ASSIGNMENTS
-- ============================================================
-- Two columns added to the table from ngo-area-assignments.sql:
--   area_name — a human label (e.g. "Sama - Savli Road") so an
--     admin/NGO can recognize an area at a glance instead of just
--     coordinates and a radius number.
--   urgency — lets an admin say "this NGO should focus on CRITICAL
--     requests in this area" in addition to (or instead of) a
--     category focus — the two filters combine, so an NGO can be
--     given something as specific as "medical + critical only" or
--     as broad as "any category, any urgency" within their radius.
-- Run this AFTER ngo-area-assignments.sql if you already ran that
-- one — this only adds to what's already there, it doesn't replace it.
-- ============================================================

alter table ngo_area_assignments add column area_name text;
alter table ngo_area_assignments add column urgency text
  check (urgency in ('critical', 'high', 'medium', 'low') or urgency is null);
