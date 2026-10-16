-- Creates a profile row automatically whenever someone signs up.
-- SECURITY: the role is NOT trusted from the browser. Only 'volunteer' and 'ngo_admin' are
-- accepted (the two public sign-up types); everything else becomes 'user'. Admins are made by
-- changing the role in the Supabase dashboard. (Same function as in security-hardening.sql.)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
    left(new.raw_user_meta_data->>'phone', 30),
    case when requested_role in ('volunteer', 'ngo_admin') then requested_role else 'user' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
