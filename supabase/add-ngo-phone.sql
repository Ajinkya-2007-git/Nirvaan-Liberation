-- ============================================================
-- ADD CONTACT_PHONE TO NGOs
-- ============================================================
-- An NGO's phone was always collected at signup (see NgoSignup.tsx)
-- and lives on their profiles row, but was never copied onto the
-- ngos table itself, and the app never actually inserted or read it
-- until now — the same reasoning as volunteer_profiles' duplicated
-- full_name/phone columns applies here: admins need to see and
-- call/copy this number, and profiles has much stricter visibility
-- rules than ngos does.
-- ============================================================

alter table ngos add column contact_phone text;
