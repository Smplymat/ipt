-- ─────────────────────────────────────────────────────────────────────────────
-- 0001_roles_profiles.sql
-- Roles & public profiles for the Knead to Know bakery app.
--
-- Run this file in the Supabase SQL Editor (or via `supabase db push`).
--
-- NOTE: this script DROPS and recreates the two tables so the schema is always
-- exactly as defined below. Safe to re-run any number of times.
-- ─────────────────────────────────────────────────────────────────────────────

-- 0) Reset so a stale/partial table shape can never survive.
--    (cascade also removes any policies attached to the tables)
drop table if exists public.user_roles cascade;
drop table if exists public.profiles  cascade;

-- 1) user_roles : which role each auth user holds
create table public.user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'customer'
             check (role in ('customer', 'store_admin', 'admin')),
  created_at timestamptz not null default now()
);

-- 2) profiles : public-side metadata mirror for auth.users (safe to expose emails to admins)
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text,
  created_at   timestamptz not null default now()
);

-- 3) Shared role check, usable from RLS policies AND directly by the client.
--    SECURITY DEFINER so it can read user_roles without tripping over RLS.
create or replace function public.has_role(role_name text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = role_name
  );
$$;

grant execute on function public.has_role(text) to anon, authenticated, service_role;

-- 4) Automatic profile + role assignment on signup.
--    The very FIRST account becomes Admin; every later signup becomes Customer.
--
--    ⚠️  IMPORTANT (Admin semantics)
--    This is a per-database bootstrap rule, not an identity claim about any
--    particular person:
--      * On an EMPTY database the first user to sign up gets the 'admin' role.
--      * The backfill below promotes the OLDEST existing user (lowest
--        created_at) on any database that already has auth.users when this
--        script first runs — NOT necessarily the account that originally
--        bootstrapped the project.
--      * After that first backfill, new signups only become 'admin' while
--        user_roles is empty (i.e. never, in practice).
--    If you need a specific person to be admin, set the role directly:
--        insert into public.user_roles (user_id, role)
--        values ('<uuid>', 'admin')
--        on conflict (user_id) do update set role = 'admin';
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  is_first boolean;
begin
  select not exists (select 1 from public.user_roles) into is_first;

  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );

  insert into public.user_roles (user_id, role)
  values (new.id, case when is_first then 'admin' else 'customer' end);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Backfill for any auth.users created BEFORE this script ran ──────────────
insert into public.profiles (id, email, display_name)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select
  u.id,
  case when u.id = (select id from auth.users order by created_at asc limit 1)
       then 'admin' else 'customer' end
from auth.users u
where not exists (select 1 from public.user_roles r where r.user_id = u.id);

-- 5) Row Level Security ───────────────────────────────────────────────────────

alter table public.user_roles enable row level security;
alter table public.profiles  enable row level security;

-- user_roles : users read their own role (for client-side authorization);
--             admins read everyone's role (for the user management panel).
drop policy if exists "user_roles: select" on public.user_roles;
create policy "user_roles: select"
  on public.user_roles for select
  using (user_id = auth.uid() or public.has_role('admin'));

-- user_roles : only Admin may assign roles.
drop policy if exists "user_roles: admin insert" on public.user_roles;
create policy "user_roles: admin insert"
  on public.user_roles for insert
  with check (public.has_role('admin'));

drop policy if exists "user_roles: admin update" on public.user_roles;
create policy "user_roles: admin update"
  on public.user_roles for update
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists "user_roles: admin delete" on public.user_roles;
create policy "user_roles: admin delete"
  on public.user_roles for delete
  using (public.has_role('admin'));

-- profiles : users read their own profile; admins read every profile.
drop policy if exists "profiles: select" on public.profiles;
create policy "profiles: select"
  on public.profiles for select
  using (id = auth.uid() or public.has_role('admin'));

-- profiles : admins may update display names.
drop policy if exists "profiles: admin update" on public.profiles;
create policy "profiles: admin update"
  on public.profiles for update
  using (public.has_role('admin'))
  with check (public.has_role('admin'));