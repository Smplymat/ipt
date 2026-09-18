-- ─────────────────────────────────────────────────────────────────────────────
-- 0003_storage_bucket_policies.sql
-- Public storage bucket for product images + RLS policies on storage.objects.
--
-- Run this file in the Supabase SQL Editor (or via `supabase db push`).
-- ─────────────────────────────────────────────────────────────────────────────

-- Create the public bucket (id and name both "product-images").
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Anyone can view product images (rows are public, so the files are too).
drop policy if exists "product-images: public read" on storage.objects;
create policy "product-images: public read"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Store Admin / Admin may upload product images.
drop policy if exists "product-images: staff insert" on storage.objects;
create policy "product-images: staff insert"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and (public.has_role('store_admin') or public.has_role('admin'))
  );

-- Store Admin / Admin may overwrite product images.
drop policy if exists "product-images: staff update" on storage.objects;
create policy "product-images: staff update"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and (public.has_role('store_admin') or public.has_role('admin'))
  );

-- Only Admin (Super Admin) may delete stored images.
drop policy if exists "product-images: admin delete" on storage.objects;
create policy "product-images: admin delete"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.has_role('admin'));