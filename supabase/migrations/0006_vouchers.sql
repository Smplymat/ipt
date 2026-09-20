-- ─────────────────────────────────────────────────────────────────────────────
-- 0006_vouchers.sql
-- Promotions (vouchers) + per-user wallet (claims) + voucher info on orders.
--
-- Lifecycle:
--   1. Anyone browses the active offer catalog (`vouchers`, public read).
--   2. A signed-in customer claims an offer -> a row in `user_vouchers`
--      (their wallet). Claiming twice is blocked by a unique constraint
--      (user_id, voucher_id).
--   3. At checkout the client picks a claimed voucher, recomputes the price
--      and stores a snapshot on the order: voucher_id, voucher_code, discount.
--   4. Right after the order is placed the wallet row flips to 'redeemed'.
--
-- Discount model (client + server share these rules):
--   eligibleSubtotal  = full cart subtotal, or subtotal of the voucher's
--                       eligible_categories when that filter is set.
--   discount          = eligibleSubtotal * discount_value/100   (percent, capped
--                       at max_discount)  or  discount_value    (fixed, capped
--                       at eligibleSubtotal).
--   minimum_spend     = required eligibleSubtotal to apply.
--   taxable           = subtotal - discount   (tax is charged after discount).
--
-- Row Level Security:
--   vouchers      : public select; staff insert/update; admin delete.
--   user_vouchers : owners can select/insert/update their own rows; staff can
--                   select all.
--
-- PostgREST endpoints (REST, anon JWT):
--   GET    /rest/v1/vouchers?select=*&active=eq.true&or=(expires_at.is.null,expires_at.gt.NOW)
--          -> 200 [ { id, code, title, description, discount_type, discount_value,
--                    minimum_spend, max_discount, eligible_categories, starts_at,
--                    expires_at, active, created_at } ]
--   POST   /rest/v1/vouchers            (staff)  body = voucher row     -> 201
--   PATCH  /rest/v1/vouchers?id=eq.<id> (staff)  body = partial row     -> 204
--   DELETE /rest/v1/vouchers?id=eq.<id> (admin)                         -> 204
--   GET    /rest/v1/user_vouchers?select=*,voucher:vouchers(*)
--          -> 200 [ { id, user_id, voucher_id, status, claimed_at, redeemed_at,
--                    used_order_id, voucher: { ...voucher fields } } ]
--   POST   /rest/v1/user_vouchers   body = { voucher_id }  (user_id forced by RLS)
--          -> 201; 409 (23505) when already claimed
--   PATCH  /rest/v1/user_vouchers?voucher_id=eq.<id>&status=eq.claimed
--          body = { status: 'redeemed', redeemed_at, used_order_id }   -> 204
--
-- Safe to re-run. Table creation is `CREATE TABLE IF NOT EXISTS`, column adds
-- are `ADD COLUMN IF NOT EXISTS`, policies are drop-if-exists + create, and the
-- seed is `ON CONFLICT (code) DO NOTHING` — re-running never wipes existing
-- claims or vouchers, and never overwrites seeded rows.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) vouchers : the offer catalog (staff-managed, read by everyone)
create table if not exists public.vouchers (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  title               text not null,
  description         text not null default '',
  discount_type       text not null check (discount_type in ('percent', 'fixed')),
  discount_value      numeric(10,2) not null check (discount_value > 0),
  minimum_spend       numeric(10,2) not null default 0 check (minimum_spend >= 0),
  max_discount        numeric(10,2) check (max_discount is null or max_discount > 0),
  eligible_categories text[] not null default '{}',
  starts_at           timestamptz not null default now(),
  expires_at          timestamptz,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

-- 2) user_vouchers : each user's claimed wallet entries
create table if not exists public.user_vouchers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  voucher_id    uuid not null references public.vouchers(id) on delete cascade,
  status        text not null default 'claimed' check (status in ('claimed', 'redeemed', 'expired')),
  claimed_at    timestamptz not null default now(),
  redeemed_at   timestamptz,
  used_order_id uuid references public.orders(id) on delete set null,
  unique (user_id, voucher_id)
);

-- 3) flex voucher snapshot onto orders (idempotent; FK re-attached below)
alter table public.orders add column if not exists discount     numeric(10,2) not null default 0;
alter table public.orders add column if not exists voucher_code text;
alter table public.orders add column if not exists voucher_id   uuid;

alter table public.orders drop constraint if exists orders_voucher_id_fkey;
alter table public.orders add constraint orders_voucher_id_fkey
  foreign key (voucher_id) references public.vouchers(id) on delete set null;

create index if not exists idx_orders_voucher        on public.orders (voucher_id);
create index if not exists idx_user_vouchers_user    on public.user_vouchers (user_id);
create index if not exists idx_vouchers_active       on public.vouchers (active, expires_at);

-- 4) Row Level Security
alter table public.vouchers      enable row level security;
alter table public.user_vouchers enable row level security;

-- vouchers - public may view the catalog
drop policy if exists "vouchers: public read" on public.vouchers;
create policy "vouchers: public read"
  on public.vouchers for select using (true);

-- vouchers - staff create / manage offers
drop policy if exists "vouchers: staff insert" on public.vouchers;
create policy "vouchers: staff insert"
  on public.vouchers for insert
  with check (public.has_role('store_admin') or public.has_role('admin'));

drop policy if exists "vouchers: staff update" on public.vouchers;
create policy "vouchers: staff update"
  on public.vouchers for update
  using (public.has_role('store_admin') or public.has_role('admin'))
  with check (public.has_role('store_admin') or public.has_role('admin'));

drop policy if exists "vouchers: admin delete" on public.vouchers;
create policy "vouchers: admin delete"
  on public.vouchers for delete
  using (public.has_role('admin'));

-- user_vouchers - users see their own wallet; staff see everyone's
drop policy if exists "user_vouchers: select" on public.user_vouchers;
create policy "user_vouchers: select"
  on public.user_vouchers for select
  using (user_id = auth.uid() or public.has_role('store_admin') or public.has_role('admin'));

-- user_vouchers - a user may claim (add) their own vouchers
drop policy if exists "user_vouchers: self insert" on public.user_vouchers;
create policy "user_vouchers: self insert"
  on public.user_vouchers for insert
  with check (user_id = auth.uid());

-- user_vouchers - the owner may flip a claim to 'redeemed' after ordering
drop policy if exists "user_vouchers: self update" on public.user_vouchers;
create policy "user_vouchers: self update"
  on public.user_vouchers for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 5) Seed the starter offers (codes match the UI copy on Promotions)
insert into public.vouchers
  (code, title, description, discount_type, discount_value, minimum_spend, max_discount, eligible_categories, expires_at)
values
  ('WELCOME15', 'First Order 15% Discount',
   'Welcome to Knead to Know! Enjoy 15% off your first order - one claim per account.',
   'percent', 15.00, 0, 150.00, '{}', null),
  ('CROIST20', '20% Off Croissants',
   'Grab your favourite flaky croissants at a special price - valid on pastries.',
   'percent', 20.00, 200.00, 100.00, ARRAY['Pastries'], null),
  ('CAKE3FOR2', 'Buy 2 Cakes, Get 1 Free',
   'Mix and match any whole cakes from our catalog - flat PHP 320 off a PHP 640+ cake order.',
   'fixed', 320.00, 640.00, null, ARRAY['Cakes'], null),
  ('FREEDEL500', 'Free Delivery on PHP 500+',
   'Order PHP 500 or more and we will waive the delivery fee for you.',
   'fixed', 60.00, 500.00, null, '{}', null),
  ('SAVE50', 'PHP 50 Off Your Next Order',
   'A little thank-you - enjoy PHP 50 off any order over PHP 250.',
   'fixed', 50.00, 250.00, null, '{}', null)
on conflict (code) do nothing;