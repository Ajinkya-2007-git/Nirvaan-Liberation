-- ============================================================
-- LET ADMINS ACTUALLY SEE PENDING NGOs
-- ============================================================
-- We had policies for "an NGO can see its own row" and "anyone can
-- see APPROVED NGOs" — but nothing let an admin see a pending NGO
-- that belongs to someone else. RLS doesn't error when this
-- happens, it just silently returns zero rows, which is exactly why
-- the approvals page showed "no organizations waiting" even though
-- one clearly existed.
-- ============================================================

create policy "admins can view all ngos"
  on ngos for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
