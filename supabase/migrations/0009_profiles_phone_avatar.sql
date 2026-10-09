-- ─────────────────────────────────────────────────────────────────────────────
-- 0009_profiles_phone_avatar.sql
-- Add phone and avatar_url columns to profiles table for user profile display.
--
-- Run this file in the Supabase SQL Editor (or via `supabase db push`).
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Add phone and avatar_url columns to profiles
alter table public.profiles
  add column if not exists phone text,
  add column if not exists avatar_url text;

-- 2) Update RLS policy to allow users to update their own phone and avatar_url
drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);