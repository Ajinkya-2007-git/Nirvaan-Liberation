-- ============================================================
-- AUTO-CREATE A PROFILE ROW WHEN SOMEONE SIGNS UP
-- ============================================================
-- The problem this solves: right after signUp(), if email
-- confirmation is required, the browser has NO active session yet
-- (auth.uid() is empty). That means any INSERT our own frontend
-- code tries to run gets correctly blocked by our RLS policies —
-- there's no logged-in user to check permissions against.
--
-- The fix: instead of the FRONTEND creating the profiles row,
-- the DATABASE creates it automatically, the instant a new
-- account is created — regardless of whether that account has
-- confirmed its email yet or has an active session. This is the
-- standard, recommended Supabase pattern for this exact problem.
-- ============================================================

-- A "function" is just a named, reusable block of SQL logic —
-- this one runs once per new signup and does the actual insert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
-- "security definer" is the important part: it means this function
-- runs with the PERMISSIONS OF WHOEVER OWNS IT (an admin-level
-- role), not the permissions of the person signing up. That's what
-- lets it bypass the normal RLS wall that would otherwise block an
-- unauthenticated insert. We're intentionally punching one very
-- narrow, controlled hole through RLS — not for the user, but for
-- this one specific, predictable, safe action.
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    -- "new" refers to the row that was just inserted into
    -- auth.users — new.id is the fresh account's id.
    new.id,
    -- raw_user_meta_data is a JSON blob Supabase lets us attach
    -- extra info to during signUp() (see the updated
    -- VolunteerSignup.tsx — we now pass full_name/phone/role in
    -- there). "->>'full_name'" pulls that one field out as text.
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'user')
  );
  return new;
end;
$$;

-- This is what actually WIRES the function above to run
-- automatically. "after insert on auth.users" means: every single
-- time a new row appears in Supabase's own login table, run
-- handle_new_user() right after.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
