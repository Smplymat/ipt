/* ============ 0001_roles_profiles.sql ============ */
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

/* ============ 0002_products_catalog.sql ============ */
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
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  category          text not null default 'Breads',
  description       text not null default '',
  price             numeric(10, 2) not null check (price >= 0),
  rating            numeric(3, 1) not null default 4.8 check (rating between 0 and 5),
  image_url         text not null default '',
  ingredients       text not null default '',
  nutritional_value text not null default '',
  extra_info        jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);

-- ── Categories table: user-managed categories beyond the hard-coded defaults ──
drop table if exists public.categories cascade;

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

-- Anyone can read categories (needed for the catalog filter).
drop policy if exists "categories: public read" on public.categories;
create policy "categories: public read"
  on public.categories for select using (true);

-- Staff may create categories.
drop policy if exists "categories: staff insert" on public.categories;
create policy "categories: staff insert"
  on public.categories for insert
  with check (public.has_role('store_admin') or public.has_role('admin'));

-- Staff may rename categories.
drop policy if exists "categories: staff update" on public.categories;
create policy "categories: staff update"
  on public.categories for update
  using (public.has_role('store_admin') or public.has_role('admin'))
  with check (public.has_role('store_admin') or public.has_role('admin'));

-- Only Admin may delete categories.
drop policy if exists "categories: admin delete" on public.categories;
create policy "categories: admin delete"
  on public.categories for delete
  using (public.has_role('admin'));

-- Seed the default categories so they appear in the dropdown from day one.
insert into public.categories (name) values
  ('Breads'), ('Pastries'), ('Cakes'), ('Cookies'), ('Muffins'), ('Seasonal')
on conflict (name) do nothing;

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

/* ============ 0003_storage_bucket_policies.sql ============ */
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

/* ============ 0004_seed_demo_products.sql ============ */
-- ─────────────────────────────────────────────────────────────────────────────
-- 0004_seed_demo_products.sql  (OPTIONAL)
-- A small starter catalog so the UI has data before you add your own.
-- Run it only if you want demo products; delete items from the Admin panel
-- or remove this script entirely if you prefer to start empty.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.products (id, name, category, description, price, rating, image_url)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Classic Sourdough',
    'Breads',
    'Stone-baked, chewy open crumb',
    185.00,
    4.9,
    'https://images.unsplash.com/photo-1585478259715-4d3064a3e247?w=400&h=400&fit=crop&auto=format'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Butter Croissant',
    'Pastries',
    'Flaky layers, pure butter dough',
    95.00,
    4.8,
    'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=400&fit=crop&auto=format'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'Choco Fudge Cake',
    'Cakes',
    'Rich dark chocolate layers',
    320.00,
    5.0,
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&auto=format'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'Double Choco Cookie',
    'Cookies',
    'Gooey centre, crispy edge',
    75.00,
    4.7,
    'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&h=400&fit=crop&auto=format'
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'Blueberry Muffin',
    'Muffins',
    'Bursting with fresh blueberries',
    95.00,
    4.8,
    'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400&h=400&fit=crop&auto=format'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'Cinnamon Roll',
    'Pastries',
    'Soft swirls with cream cheese glaze',
    120.00,
    4.6,
    'https://images.unsplash.com/photo-1609342122563-a43ac8917a3a?w=400&h=400&fit=crop&auto=format'
  )
on conflict (id) do nothing;

/* ============ 0005_orders.sql ============ */
-- ─────────────────────────────────────────────────────────────────────────────
-- 0005_orders.sql
-- Orders, order items, delivery details, payment info and status tracking.
--
-- Run this file in the Supabase SQL Editor (or via `supabase db push`).
--
-- NOTE: this script DROPS and recreates the two tables so the schema is always
-- exactly as defined below. Safe to re-run any number of times (it wipes any
-- existing orders).
--
-- fulfillment_type: 'delivery' (default) or 'pickup'
-- scheduled_at:     NULL = ASAP, otherwise requested delivery/pickup datetime
-- Status flow:
--   delivery:  pending → preparing → out_for_delivery → delivered
--   pickup:    pending → preparing → ready_for_pickup → delivered
--   (cancelled anytime by staff OR by the customer while still 'pending')
-- ─────────────────────────────────────────────────────────────────────────────

-- 0) Reset
drop table if exists public.order_items cascade;
drop table if exists public.orders      cascade;

-- 1) orders : one row per placed order, with delivery + payment snapshot
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete set null,
  customer_name    text not null,
  phone            text not null,
  -- Fulfillment mode
  fulfillment_type text not null default 'delivery'
                   check (fulfillment_type in ('delivery', 'pickup')),
  -- Address fields are empty for pickup orders
  address          text not null default '',
  unit_notes       text not null default '',
  latitude         double precision,
  longitude        double precision,
  -- Schedule: null = ASAP, otherwise the requested datetime
  scheduled_at     timestamptz,
  payment_method   text not null default 'cod'
                   check (payment_method in ('cod', 'online')),
  payment_status   text not null default 'pending'
                   check (payment_status in ('pending', 'paid', 'failed')),
  subtotal         numeric(10,2) not null default 0,
  delivery_fee     numeric(10,2) not null default 0,
  tax              numeric(10,2) not null default 0,
  total            numeric(10,2) not null default 0,
  status           text not null default 'pending'
                   check (status in ('pending', 'preparing', 'out_for_delivery',
                                     'ready_for_pickup', 'delivered', 'cancelled')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 2) order_items : line items snapshot (survives later product edits)
create table public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name       text not null,
  price      numeric(10,2) not null,
  quantity   integer not null check (quantity > 0),
  image_url  text not null default '',
  created_at timestamptz not null default now()
);

-- 3) indexes
create index if not exists idx_orders_user        on public.orders (user_id);
create index if not exists idx_orders_status      on public.orders (status);
create index if not exists idx_orders_scheduled   on public.orders (scheduled_at);
create index if not exists idx_order_items_order  on public.order_items (order_id);

-- 4) updated_at upkeep
create or replace function public.set_updated_at()
returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated
  before update on public.orders
  for each row execute function public.set_updated_at();

-- 5) Row Level Security
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;

-- orders ─ select: owner, or staff.
create policy "orders_select" on public.orders
  for select using (
    user_id = auth.uid()
    or public.has_role('store_admin')
    or public.has_role('admin')
  );

-- orders ─ insert: only for yourself (client always sends auth.uid()).
create policy "orders_insert" on public.orders
  for insert with check (user_id = auth.uid());

-- orders ─ update: staff may update any field;
--                  customers may only cancel their own PENDING order.
drop policy if exists "orders_update" on public.orders;
create policy "orders_update" on public.orders
  for update using (
    -- staff can update anything
    public.has_role('store_admin') or public.has_role('admin')
    -- customer can cancel their own order while it is still pending
    or (user_id = auth.uid() and status = 'pending')
  )
  with check (
    public.has_role('store_admin') or public.has_role('admin')
    or (user_id = auth.uid() and status = 'cancelled')
  );

-- orders ─ delete: staff only. Customers no longer delete their own orders —
-- the checkout creates orders through the SECURITY DEFINER `place_order`
-- function (see 0008) which is transactional, so there is no orphan-cleanup
-- path left, and allowing self-delete would let customers erase their order
-- history. Deleting a non-cancelled order restores its stock (see 0008).
drop policy if exists "orders_delete" on public.orders;
create policy "orders_delete" on public.orders
  for delete using (
    public.has_role('store_admin') or public.has_role('admin')
  );

-- order_items ─ select: via an order the user owns, or staff.
create policy "order_items_select" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.user_id = auth.uid() or public.has_role('store_admin') or public.has_role('admin'))
    )
  );

-- order_items ─ insert: placed as part of your own order, or staff.
create policy "order_items_insert" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.user_id = auth.uid() or public.has_role('store_admin') or public.has_role('admin'))
    )
  );

-- 6) Realtime: broadcast order changes so customer + staff UIs update live.
do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception when others then
    null; -- already a member of the publication
  end;
end $$;

/* ============ 0006_vouchers.sql ============ */
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

/* ============ 0007_stock_more_tables.sql ============ */
-- ─────────────────────────────────────────────────────────────────────────────
-- 0007_stock_more_tables.sql
-- Inventory + supporting modules for the Knead to Know bakery app:
--   * products.stock_quantity (with safe deduct-on-order / restore-on-cancel)
--   * addresses      (user address book for delivery)
--   * reviews        (per-product ratings tied to real products)
--   * notifications  (in-app inbox, written by database triggers)
--   * custom_orders  (custom/bespoke order requests)
--   * newsletter_subscribers (public subscription list)
--
-- Run this file in the Supabase SQL Editor (or via `supabase db push`).
-- SAFE TO RE-RUN: all tables are CREATE TABLE IF NOT EXISTS, every policy is
-- drop-if-exists + create, the demo seed only touches products whose stock is
-- still at the column default AND has never been ordered, and the rating
-- refresh trigger is recreated with `create or replace`. Re-running never
-- drops or clobbers existing rows.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Inventory ────────────────────────────────────────────────────────────────

alter table public.products add column if not exists stock_quantity integer not null default 0;

-- Any pre-existing negative stock (e.g. a bad manual edit) is clamped to 0
-- BEFORE the non-negative check below is enforced, so the constraint can be
-- added safely on a database that already contains live rows.
update public.products set stock_quantity = 0 where stock_quantity < 0;

-- Enforce stock_quantity >= 0 with a named check. The DO block (instead of
-- `add constraint`) keeps this re-runnable: Postgres has no `ADD CONSTRAINT
-- IF NOT EXISTS`, and a live database may already carry an older anonymous
-- check with the same effect — in that case we detect it and leave it alone.
do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint con
      join pg_catalog.pg_class      rel on rel.oid = con.conrelid
      join pg_catalog.pg_namespace  nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public'
       and rel.relname = 'products'
       and con.contype = 'c'
       and exists (
         select 1
           from pg_catalog.pg_attribute att
          where att.attrelid = con.conrelid
            and att.attnum = any (con.conkey)
            and att.attname = 'stock_quantity'
       )
  ) then
    alter table public.products
      add constraint products_stock_quantity_nonneg_check check (stock_quantity >= 0);
  end if;
end $$;

-- Give the demo bakes realistic levels so the shop looks alive.
-- (Convenience for testing: one low-stock item, one sold-out item.)
-- Guarded so re-running NEVER overwrites live inventory: a product is only
-- seeded when its stock is still at the column default (0) and no order line
-- has ever referenced it (i.e. it has not been sold down to zero by real
-- orders). On the seeded demo set this runs exactly once.
update public.products p set stock_quantity =
  case p.name
    when 'Classic Sourdough'   then 12
    when 'Butter Croissant'    then 24
    when 'Choco Fudge Cake'    then 3
    when 'Double Choco Cookie' then 40
    when 'Blueberry Muffin'    then 6
    when 'Cinnamon Roll'       then 0
    else p.stock_quantity
  end
where p.stock_quantity = 0
  and not exists (select 1 from public.order_items oi where oi.product_id = p.id);

-- Deduct stock atomically as line items are written. Runs SECURITY DEFINER so
-- it bypasses RLS; if a product lacks enough stock the whole order insert is
-- rolled back (client sees a friendly error and no order is created).
create or replace function public.token_inventory_deduct()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  product_name text;
begin
  if new.product_id is not null then
    update public.products
       set stock_quantity = stock_quantity - new.quantity
     where id = new.product_id
       and stock_quantity >= new.quantity;

    if not found then
      select name into product_name from public.products where id = new.product_id;
      raise exception 'Not enough stock for %. Please reduce your quantity or pick something else.',
        coalesce(product_name, new.product_id::text);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_order_items_deduct_stock on public.order_items;
create trigger trg_order_items_deduct_stock
  after insert on public.order_items
  for each row execute function public.token_inventory_deduct();

-- Restore stock when an order is cancelled (either by staff or by the owner).
create or replace function public.token_inventory_restock()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.products p
       set stock_quantity = p.stock_quantity + oi.quantity
      from public.order_items oi
     where oi.order_id = new.id
       and oi.product_id = p.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_orders_restore_stock on public.orders;
create trigger trg_orders_restore_stock
  after update of status on public.orders
  for each row execute function public.token_inventory_restock();

-- 2) Address book ────────────────────────────────────────────────────────────

create table if not exists public.addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  label        text not null default 'Home',
  recipient    text not null,
  phone        text not null,
  address_line text not null,
  city         text not null default '',
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.addresses enable row level security;

drop policy if exists "addresses: select own" on public.addresses;
create policy "addresses: select own"
  on public.addresses for select
  using (auth.uid() = user_id);

drop policy if exists "addresses: insert own" on public.addresses;
create policy "addresses: insert own"
  on public.addresses for insert
  with check (auth.uid() = user_id);

drop policy if exists "addresses: update own" on public.addresses;
create policy "addresses: update own"
  on public.addresses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "addresses: delete own" on public.addresses;
create policy "addresses: delete own"
  on public.addresses for delete
  using (auth.uid() = user_id);

create index if not exists idx_addresses_user on public.addresses (user_id);

-- 3) Reviews ─────────────────────────────────────────────────────────────────

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  author_name text not null default '',
  rating      integer not null check (rating between 1 and 5),
  comment     text not null default '',
  created_at  timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table public.reviews enable row level security;

-- Anyone may read the review wall / product ratings.
drop policy if exists "reviews: public read" on public.reviews;
create policy "reviews: public read"
  on public.reviews for select
  using (true);

-- A signed-in customer may leave a review (one per product per account).
drop policy if exists "reviews: self insert" on public.reviews;
create policy "reviews: self insert"
  on public.reviews for insert
  with check (auth.uid() = user_id);

drop policy if exists "reviews: self update" on public.reviews;
create policy "reviews: self update"
  on public.reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reviews: self delete" on public.reviews;
create policy "reviews: self delete"
  on public.reviews for delete
  using (auth.uid() = user_id);

create index if not exists idx_reviews_product on public.reviews (product_id);
create index if not exists idx_reviews_user on public.reviews (user_id);

-- Snapshot the author's display name at write time so the public review wall
-- can show names without exposing the profiles table (which is staff-only).
create or replace function public.token_review_author()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.author_name := coalesce((
    select p.display_name from public.profiles p where p.id = new.user_id
  ), '');
  return new;
end $$;

drop trigger if exists trg_reviews_author_name on public.reviews;
create trigger trg_reviews_author_name
  before insert on public.reviews
  for each row execute function public.token_review_author();

-- Recompute a product's star rating from its real reviews whenever a review
-- is written OR deleted. When the last review for a product disappears the
-- rating is reset to the column default (4.8) so a stale average never lingers.
create or replace function public.token_review_refresh()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_product_id uuid := coalesce(new.product_id, old.product_id);
  v_new_rating numeric(3, 1);
begin
  select round(avg(r.rating)::numeric, 1) into v_new_rating
    from public.reviews r
   where r.product_id = v_product_id;

  if v_new_rating is not null then
    update public.products p
       set rating = v_new_rating
     where p.id = v_product_id;
  else
    -- No reviews left → reset to the products.rating column default (4.8).
    update public.products p
       set rating = 4.8
     where p.id = v_product_id;
  end if;

  -- This function runs against both NEW and OLD rows; return whichever exists.
  return coalesce(new, old);
end $$;

drop trigger if exists trg_reviews_refresh_rating on public.reviews;
create trigger trg_reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.token_review_refresh();

-- 4) Notifications ───────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  type         text not null check (type in ('order_confirmation', 'order_update', 'new_product', 'promotion', 'custom_order')),
  title        text not null,
  body         text not null default '',
  link         text not null default '',
  reference_id uuid,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- Each user only ever sees their own inbox. Inserts come from database
-- triggers (SECURITY DEFINER), so no user-facing insert policy is needed.
drop policy if exists "notifications: select own" on public.notifications;
create policy "notifications: select own"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Users may mark their own notifications as read (nothing else).
drop policy if exists "notifications: update own" on public.notifications;
create policy "notifications: update own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_notifications_user_read on public.notifications (user_id, read);

-- In-app triggers (RFC 3339 timestamps handled by created_at default).

-- Order created → confirmation for the owner.
create or replace function public.token_notify_order()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  short_id text := upper(left(replace(new.id::text, '-', ''), 8));
begin
  if tg_op = 'INSERT' and new.user_id is not null then
    insert into public.notifications (user_id, type, title, body, link, reference_id)
    values (new.user_id, 'order_confirmation', 'Order confirmed',
            format('Your order #%s has been received. We''re on it!', short_id),
            '/orders', new.id);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.user_id is not null then
    insert into public.notifications (user_id, type, title, body, link, reference_id)
    values (new.user_id, 'order_update', 'Order status update',
            format('Order #%s is now %s.', short_id,
              case new.status
                when 'pending'          then 'Pending'
                when 'preparing'        then 'Preparing'
                when 'out_for_delivery' then 'On Delivery'
                when 'ready_for_pickup' then 'Ready for Pickup'
                when 'delivered'        then 'Finished'
                when 'cancelled'        then 'Cancelled'
                else new.status
              end),
            '/orders', new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_orders_notify on public.orders;
create trigger trg_orders_notify
  after insert or update of status on public.orders
  for each row execute function public.token_notify_order();

-- New product → broadcast "new bread" to all customers.
create or replace function public.token_notify_new_product()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link, reference_id)
  select r.user_id, 'new_product', 'New bread alert',
         format('Fresh from the oven: %s is now available!', new.name),
         '/bread-catalog', new.id
    from public.user_roles r
   where r.role = 'customer';
  return new;
end $$;

drop trigger if exists trg_products_notify on public.products;
create trigger trg_products_notify
  after insert on public.products
  for each row execute function public.token_notify_new_product();

-- New promotion → broadcast to all customers.
create or replace function public.token_notify_promotion()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link, reference_id)
  select r.user_id, 'promotion', 'New promotion available',
         format('%s — check the Promotions page and claim it before it is gone!', new.title),
         '/promotions', new.id
    from public.user_roles r
   where r.role = 'customer';
  return new;
end $$;

drop trigger if exists trg_vouchers_notify on public.vouchers;
create trigger trg_vouchers_notify
  after insert on public.vouchers
  for each row execute function public.token_notify_promotion();

-- 5) Custom orders ───────────────────────────────────────────────────────────

create table if not exists public.custom_orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  phone       text not null,
  description text not null,
  quantity    integer not null default 1 check (quantity >= 1),
  deadline    text not null default '',
  status      text not null default 'new' check (status in ('new', 'approved', 'declined')),
  created_at  timestamptz not null default now()
);

alter table public.custom_orders enable row level security;

-- Owners and staff may both view requests.
drop policy if exists "custom_orders: select own or staff" on public.custom_orders;
create policy "custom_orders: select own or staff"
  on public.custom_orders for select
  using (auth.uid() = user_id or public.has_role('store_admin') or public.has_role('admin'));

drop policy if exists "custom_orders: insert own" on public.custom_orders;
create policy "custom_orders: insert own"
  on public.custom_orders for insert
  with check (auth.uid() = user_id);

-- Owners can tweak their own new requests; staff approve/decline.
drop policy if exists "custom_orders: update" on public.custom_orders;
create policy "custom_orders: update"
  on public.custom_orders for update
  using (auth.uid() = user_id or public.has_role('store_admin') or public.has_role('admin'))
  with check (auth.uid() = user_id or public.has_role('store_admin') or public.has_role('admin'));

create index if not exists idx_custom_orders_user on public.custom_orders (user_id);

-- Custom request received → staff notification (all admins/store admins).
create or replace function public.token_notify_custom_order()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link, reference_id)
  select r.user_id, 'custom_order',
         'New custom order request',
         format('%s requested "%s" x%s. Review it in the Admin panel.', new.name, left(new.description, 60), new.quantity),
         '/admin', new.id
    from public.user_roles r
   where r.role in ('store_admin', 'admin');
  return new;
end $$;

drop trigger if exists trg_custom_orders_notify on public.custom_orders;
create trigger trg_custom_orders_notify
  after insert on public.custom_orders
  for each row execute function public.token_notify_custom_order();

-- 6) Newsletter ───────────────────────────────────────────────────────────────

create table if not exists public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  origin     text not null default 'dashboard',
  created_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

-- Anyone may subscribe (public form); the list itself is staff-only.
drop policy if exists "newsletter: public insert" on public.newsletter_subscribers;
create policy "newsletter: public insert"
  on public.newsletter_subscribers for insert
  with check (true);

drop policy if exists "newsletter: staff read" on public.newsletter_subscribers;
create policy "newsletter: staff read"
  on public.newsletter_subscribers for select
  using (public.has_role('store_admin') or public.has_role('admin'));

-- 7) Profile self-service ────────────────────────────────────────────────────
-- Allow users to update their own display name (Edit Profile); admins keep the
-- existing broad permission via the original admin-only update policy.

drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

/* ============ 0008_order_integrity.sql ============ */
-- ─────────────────────────────────────────────────────────────────────────────
-- 0008_order_integrity.sql
-- Server-authoritative checkout for the Knead to Know bakery app.
-- Everything in this file is ADDITIVE and idempotent, so it can be run on a
-- live database that already contains real users, orders and stock.
--
-- It fixes:
--   F2  stock is restored when an order is DELETED (not only when cancelled)
--   F8  the cancelled → pending → cancelled double-restore loophole
--   F3  order totals / voucher redemption are computed and validated
--       server-side inside one transaction (place_order), never trusted
--       from the client
--   F6  products.rating is recomputed when a review is DELETED as well
--   (   a named non-negative stock constraint + clamping of any existing
--       negative stock, so staff can never push stock below zero)
--
-- Safe to re-run: every object is created with IF NOT EXISTS / create or
-- replace / drop-if-exists-then-create.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) F2/F8 — Stock integrity on orders ─────────────────────────────────────────

-- Tracks whether an order's stock has already been returned to products, so
-- stock can never be restored twice (cancelled→pending→cancelled loophole).
alter table public.orders add column if not exists stock_restored boolean not null default false;

-- Restock on CANCEL, guarded by the stock_restored flag: restore exactly once
-- and immediately flag the order. Sequencing via `update of status` means the
-- flag-write below never re-enters this trigger, and the notify trigger only
-- fires when status actually changes.
create or replace function public.token_inventory_restock()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'cancelled' and not new.stock_restored then
    update public.products p
       set stock_quantity = p.stock_quantity + oi.quantity
      from public.order_items oi
     where oi.order_id = new.id
       and oi.product_id = p.id;

    update public.orders
       set stock_restored = true
     where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_orders_restore_stock on public.orders;
create trigger trg_orders_restore_stock
  after update of status on public.orders
  for each row execute function public.token_inventory_restock();

-- Restock on DELETE. An AFTER DELETE trigger still sees the full old row
-- (including stock_restored), so deleting a non-cancelled order whose stock
-- was never returned puts the items back exactly once.
create or replace function public.token_inventory_restock_delete()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.status is distinct from 'cancelled' and not old.stock_restored then
    update public.products p
       set stock_quantity = p.stock_quantity + oi.quantity
      from public.order_items oi
     where oi.order_id = old.id
       and oi.product_id = p.id;
  end if;
  return old;
end $$;

drop trigger if exists trg_orders_restore_stock_on_delete on public.orders;
create trigger trg_orders_restore_stock_on_delete
  after delete on public.orders
  for each row execute function public.token_inventory_restock_delete();

-- Deletion is staff-only. (0005 already defines it this way for fresh builds;
-- this re-applies the same rule to databases created from the old 0005.)
drop policy if exists "orders_delete" on public.orders;
create policy "orders_delete" on public.orders
  for delete using (
    public.has_role('store_admin') or public.has_role('admin')
  );

-- 2) Stock floor — non-negative quantity, enforced at the database ────────────

-- Any pre-existing negative stock is clamped first so the constraint below can
-- be added on a database that already contains rows. (No-op on healthy stock.)
update public.products set stock_quantity = 0 where stock_quantity < 0;

-- Ensure a check constraint on stock_quantity exists. The DO block is required
-- because Postgres has no `ADD CONSTRAINT IF NOT EXISTS`, and an older live
-- database may already carry an anonymous check with the same effect.
do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint con
      join pg_catalog.pg_class      rel on rel.oid = con.conrelid
      join pg_catalog.pg_namespace  nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public'
       and rel.relname = 'products'
       and con.contype = 'c'
       and exists (
         select 1
           from pg_catalog.pg_attribute att
          where att.attrelid = con.conrelid
            and att.attnum = any (con.conkey)
            and att.attname = 'stock_quantity'
       )
  ) then
    alter table public.products
      add constraint products_stock_quantity_nonneg_check check (stock_quantity >= 0);
  end if;
end $$;

-- 3) F6 — Rating refresh also fires on review DELETE ───────────────────────────
-- (Mirrors the amended 0007 for live databases that still carry the old
--  insert/update-only trigger.)

create or replace function public.token_review_refresh()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_product_id uuid := coalesce(new.product_id, old.product_id);
  v_new_rating numeric(3, 1);
begin
  select round(avg(r.rating)::numeric, 1) into v_new_rating
    from public.reviews r
   where r.product_id = v_product_id;

  if v_new_rating is not null then
    update public.products p
       set rating = v_new_rating
     where p.id = v_product_id;
  else
    -- No reviews left → reset to the products.rating column default (4.8).
    update public.products p
       set rating = 4.8
     where p.id = v_product_id;
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists trg_reviews_refresh_rating on public.reviews;
create trigger trg_reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.token_review_refresh();

-- 4) F3 — Server-authoritative checkout ────────────────────────────────────────
--
-- Customers may no longer INSERT into orders / order_items or UPDATE their
-- own user_vouchers directly — the browser could otherwise write any price,
-- total or discount it wanted. All order placement now flows through the
-- SECURITY DEFINER place_order() function below, which:
--   * reads prices and stock from products (never from the client)
--   * derives payment_status from payment_method (online → paid)
--   * validates the voucher server-side (active, in window, min spend,
--     category eligibility, cap, not already redeemed by the caller)
--   * computes subtotal / delivery fee / discount / tax / total with the same
--     rules checkout.component.ts uses for its preview
--   * marks the voucher redeemed, tied to the new order, in the same transaction
--   * returns the created order
-- Staff keep direct API insert access for admin workflows.

drop policy if exists "orders_insert" on public.orders;
create policy "orders_insert" on public.orders
  for insert with check (
    public.has_role('store_admin') or public.has_role('admin')
  );

drop policy if exists "order_items_insert" on public.order_items;
create policy "order_items_insert" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (public.has_role('store_admin') or public.has_role('admin'))
    )
  );

-- Customers no longer flip their own wallet entries; place_order() performs
-- redemption. (Owners may still INSERT claims — that's the Promotions page.)
drop policy if exists "user_vouchers: self update" on public.user_vouchers;

create or replace function public.place_order(
  p_customer_name text,
  p_phone text,
  p_fulfillment_type text,
  p_address text,
  p_unit_notes text,
  p_latitude double precision,
  p_longitude double precision,
  p_scheduled_at timestamptz,
  p_payment_method text,
  p_cart jsonb,
  p_promo_code text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id        uuid := auth.uid();
  v_fulfillment    text;
  v_address        text;
  v_unit_notes     text;
  v_lat            double precision;
  v_lng            double precision;
  v_payment_status text;
  v_line           record;
  v_product        record;
  v_subtotal       numeric(10,2) := 0;
  v_eligible       numeric(10,2) := 0;
  v_delivery_fee   numeric(10,2);
  v_discount       numeric(10,2) := 0;
  v_voucher_id     uuid;
  v_voucher_code   text;
  v_voucher        record;
  v_raw_discount   numeric(10,2);
  v_taxable        numeric(10,2);
  v_tax            numeric(10,2);
  v_total          numeric(10,2);
  v_order          public.orders;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to place an order.';
  end if;

  if jsonb_typeof(p_cart) <> 'array' or jsonb_array_length(p_cart) = 0 then
    raise exception 'Your cart is empty.';
  end if;

  v_fulfillment := coalesce(p_fulfillment_type, 'delivery');
  if v_fulfillment not in ('delivery', 'pickup') then
    raise exception 'Invalid fulfillment type.';
  end if;

  if p_payment_method not in ('cod', 'online') then
    raise exception 'Invalid payment method.';
  end if;
  v_payment_status := case when p_payment_method = 'online' then 'paid' else 'pending' end;

  if btrim(p_customer_name) = '' or btrim(p_phone) = '' then
    raise exception 'Recipient name and phone are required.';
  end if;

  if v_fulfillment = 'pickup' then
    v_address := '';
    v_unit_notes := '';
    v_lat := null;
    v_lng := null;
  else
    v_address := coalesce(p_address, '');
    v_unit_notes := coalesce(p_unit_notes, '');
    v_lat := p_latitude;
    v_lng := p_longitude;
    if btrim(v_address) = '' then
      raise exception 'Delivery address is required.';
    end if;
  end if;

  -- Resolve the voucher / promo code first so its eligibility affects totals.
  if p_promo_code is not null and btrim(p_promo_code) <> '' then
    select v.*
      into v_voucher
      from public.vouchers v
     where upper(v.code) = upper(btrim(p_promo_code))
       and v.active
       and (v.starts_at is null or v.starts_at <= now())
       and (v.expires_at is null or v.expires_at > now());

    if v_voucher.id is null then
      raise exception 'Invalid or expired promo code.';
    end if;

    if exists (
      select 1 from public.user_vouchers uv
       where uv.user_id = v_user_id
         and uv.voucher_id = v_voucher.id
         and uv.status = 'redeemed'
    ) then
      raise exception 'This voucher has already been redeemed.';
    end if;

    v_voucher_id   := v_voucher.id;
    v_voucher_code := v_voucher.code;
  end if;

  -- Read prices + stock from products (never from the client) and compute the
  -- subtotal, plus the voucher-eligible subtotal when a category filter applies.
  for v_line in
    select i.product_id, i.qty
      from jsonb_to_recordset(p_cart) as i(product_id uuid, qty int)
  loop
    if v_line.product_id is null then
      raise exception 'Your cart contains an unknown product.';
    end if;

    select p.*
      into v_product
      from public.products p
     where p.id = v_line.product_id;

    if v_product.id is null then
      raise exception 'Your cart contains an unavailable product.';
    end if;

    if v_line.qty is null or v_line.qty <= 0 then
      raise exception 'Invalid quantity for %.', v_product.name;
    end if;

    if v_product.stock_quantity < v_line.qty then
      raise exception 'Not enough stock for %. Please reduce your quantity or pick something else.',
        v_product.name;
    end if;

    v_subtotal := v_subtotal + v_product.price * v_line.qty;

    if v_voucher_id is not null
       and (v_voucher.eligible_categories is null
            or array_length(v_voucher.eligible_categories, 1) is null
            or v_product.category = any (v_voucher.eligible_categories)) then
      v_eligible := v_eligible + v_product.price * v_line.qty;
    end if;
  end loop;

  -- Delivery fee: ₱60 waived at ₱500+; pickup is always free.
  v_delivery_fee := case
    when v_fulfillment = 'delivery' and v_subtotal < 500 then 60
    else 0
  end;

  -- Voucher discount, mirroring checkout.component.ts / vouchers.service.ts:
  --   percent → eligible * value/100 capped at max_discount
  --   fixed   → value capped at the eligible subtotal
  -- minimum_spend (vs eligible) is required; discount never exceeds eligible.
  if v_voucher_id is not null then
    if v_eligible <= 0 then
      raise exception 'The promo code does not apply to anything in your basket.';
    end if;
    if v_eligible < v_voucher.minimum_spend then
      raise exception 'Spend ₱% or more to apply this promo code.',
        to_char(v_voucher.minimum_spend, '999,999.99');
    end if;

    v_raw_discount := case
      when v_voucher.discount_type = 'percent'
        then v_eligible * v_voucher.discount_value / 100
      else v_voucher.discount_value
    end;
    if v_voucher.max_discount is not null then
      v_raw_discount := least(v_raw_discount, v_voucher.max_discount);
    end if;
    v_discount := round(least(greatest(v_raw_discount, 0), v_eligible), 2);
  end if;

  v_taxable := greatest(v_subtotal - v_discount, 0);
  v_tax     := round(v_taxable * 0.12, 2);
  v_total   := round(v_taxable + v_delivery_fee + v_tax, 2);

  -- 5) Persist the order + items in one transaction.
  insert into public.orders (
    user_id, customer_name, phone, fulfillment_type, address, unit_notes,
    latitude, longitude, scheduled_at, payment_method, payment_status,
    subtotal, delivery_fee, tax, total, discount, voucher_code, voucher_id
  ) values (
    v_user_id, btrim(p_customer_name), btrim(p_phone), v_fulfillment,
    v_address, v_unit_notes, v_lat, v_lng, p_scheduled_at,
    p_payment_method, v_payment_status,
    v_subtotal, v_delivery_fee, v_tax, v_total, v_discount,
    v_voucher_code, v_voucher_id
  )
  returning * into v_order;

  insert into public.order_items (order_id, product_id, name, price, quantity, image_url)
  select v_order.id, i.product_id, p.name, p.price, i.qty, p.image_url
    from jsonb_to_recordset(p_cart) as i(product_id uuid, qty int)
    join public.products p on p.id = i.product_id;

  -- 6) Mark the voucher redeemed against this order (same transaction).
  if v_voucher_id is not null then
    update public.user_vouchers
       set status = 'redeemed',
           redeemed_at = now(),
           used_order_id = v_order.id
     where user_id = v_user_id
       and voucher_id = v_voucher_id
       and status = 'claimed';
  end if;

  return v_order;
end $$;

-- Only signed-in customers may call this; the default PUBLIC execute is revoked
-- so anonymous (anon) traffic gets a clean permission error.
revoke execute on function public.place_order(
  text, text, text, text, text, double precision, double precision,
  timestamptz, text, jsonb, text
) from public, anon;
grant execute on function public.place_order(
  text, text, text, text, text, double precision, double precision,
  timestamptz, text, jsonb, text
) to authenticated;

