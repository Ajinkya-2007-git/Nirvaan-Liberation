-- ============================================================
-- ENABLE REALTIME
-- ============================================================
-- The map's live updates rely on Supabase broadcasting database
-- changes over a websocket. That broadcasting is OFF by default
-- for every table until we explicitly turn it on — otherwise our
-- realtime code would connect successfully but silently never
-- receive anything, which is a confusing bug to chase.
-- ============================================================

alter publication supabase_realtime add table sos_requests;
alter publication supabase_realtime add table volunteer_profiles;
