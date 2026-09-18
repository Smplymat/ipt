-- ─────────────────────────────────────────────────────────────────────────────
-- 0002_products_catalog.sql
-- Product catalog table with Row Level Security.
--
-- Run this file in the Supabase SQL Editor (or via `supabase db push`).
--
-- NOTE: this script DROPS and recreates the table so its schema is always
-- exactly as defined below. Safe to re-run any number of times (with the
-- caveat that any manually added products are removed before reseeding).
-- ─────────────────────────────────────────────────────────────────────────────

-- 0) Reset so a stale/partial table shape can never survive.
drop table if exists public.products cascade;

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'Breads',
  description text not null default '',
  price       numeric(10, 2) not null check (price >= 0),
  rating      numeric(3, 1) not null default 4.8 check (rating between 0 and 5),
  image_url   text not null default '',
  created_at  timestamptz not null default now()
);

alter table public.products enable row level security;

-- Public read: any visitor (signed in or not) can view the catalog.
drop policy if exists "products: public read" on public.products;
create policy "products: public read"
  on public.products for select
  using (true);

-- Store Admin / Admin may create items.
drop policy if exists "products: staff insert" on public.products;
create policy "products: staff insert"
  on public.products for insert
  with check (public.has_role('store_admin') or public.has_role('admin'));

-- Store Admin / Admin may update items (rename, reprice, replace image).
drop policy if exists "products: staff update" on public.products;
create policy "products: staff update"
  on public.products for update
  using (public.has_role('store_admin') or public.has_role('admin'))
  with check (public.has_role('store_admin') or public.has_role('admin'));

-- Only Admin (Super Admin) may delete products.
drop policy if exists "products: admin delete" on public.products;
create policy "products: admin delete"
  on public.products for delete
  using (public.has_role('admin'));