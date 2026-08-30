-- ============================================================
-- ALLOW ANONYMOUS "QUICK SOS" REQUESTS (NO REPORTER DETAILS)
-- ============================================================
-- The full Request Help form still REQUIRES a name and phone —
-- that's enforced in the frontend form, not by the database. But
-- the new one-tap SOS button on the landing page deliberately
-- collects NOTHING except location — no name, no phone, nothing to
-- type at all. For that to be possible, the database itself has to
-- stop demanding those two columns.
-- ============================================================

alter table sos_requests alter column reporter_name drop not null;
alter table sos_requests alter column reporter_phone drop not null;
