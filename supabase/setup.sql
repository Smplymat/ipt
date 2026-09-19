/* ============ 0001_roles_profiles.sql ============ */
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 0001_roles_profiles.sql
-- Roles & public profiles for the Knead to Know bakery app.
--
-- Run this file in the Supabase SQL Editor (or via `supabase db push`).
--
-- NOTE: this script DROPS and recreates the two tables so the schema is always
-- exactly as defined below. Safe to re-run any number of times.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

-- â”€â”€ Backfill for any auth.users created BEFORE this script ran â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- 5) Row Level Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 0002_products_catalog.sql
-- Product catalog table with Row Level Security.
--
-- Run this file in the Supabase SQL Editor (or via `supabase db push`).
--
-- NOTE: this script DROPS and recreates the table so its schema is always
-- exactly as defined below. Safe to re-run any number of times (with the
-- caveat that any manually added products are removed before reseeding).
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

/* ============ 0003_storage_bucket_policies.sql ============ */
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 0003_storage_bucket_policies.sql
-- Public storage bucket for product images + RLS policies on storage.objects.
--
-- Run this file in the Supabase SQL Editor (or via `supabase db push`).
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 0004_seed_demo_products.sql  (OPTIONAL)
-- A small starter catalog so the UI has data before you add your own.
-- Run it only if you want demo products; delete items from the Admin panel
-- or remove this script entirely if you prefer to start empty.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 0005_orders.sql
-- Orders, order items, delivery details, payment info and status tracking.
--
-- Run this file in the Supabase SQL Editor (or via `supabase db push`).
--
-- NOTE: this script DROPS and recreates the two tables so the schema is always
-- exactly as defined below. Safe to re-run any number of times (it wipes any
-- existing orders).
--
-- Status flow (driven by staff in the Fulfillment view):
--   pending â†’ preparing â†’ out_for_delivery â†’ delivered     (cancelled anytime)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- 0) Reset
drop table if exists public.order_items cascade;
drop table if exists public.orders      cascade;

-- 1) orders : one row per placed order, with delivery + payment snapshot
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete set null,
  customer_name    text not null,
  phone            text not null,
  address          text not null,
  unit_notes       text not null default '',
  latitude         double precision,
  longitude        double precision,
  payment_method   text not null default 'cod'
                   check (payment_method in ('cod', 'online')),
  payment_status   text not null default 'pending'
                   check (payment_status in ('pending', 'paid', 'failed')),
  subtotal         numeric(10,2) not null default 0,
  delivery_fee     numeric(10,2) not null default 0,
  tax              numeric(10,2) not null default 0,
  total            numeric(10,2) not null default 0,
  status           text not null default 'pending'
                   check (status in ('pending', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
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
create index if not exists idx_orders_user          on public.orders (user_id);
create index if not exists idx_orders_status        on public.orders (status);
create index if not exists idx_order_items_order    on public.order_items (order_id);

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

-- orders â”€ select: owner, or staff.
create policy "orders_select" on public.orders
  for select using (
    user_id = auth.uid()
    or public.has_role('store_admin')
    or public.has_role('admin')
  );

-- orders â”€ insert: only for yourself (client always sends auth.uid()).
create policy "orders_insert" on public.orders
  for insert with check (user_id = auth.uid());

-- orders â”€ update: staff only (status / payment tracking).
create policy "orders_update" on public.orders
  for update using (
    public.has_role('store_admin') or public.has_role('admin')
  );

-- orders â”€ delete: owner (e.g. client-side cleanup of a failed order) or staff.
create policy "orders_delete" on public.orders
  for delete using (
    user_id = auth.uid()
    or public.has_role('store_admin')
    or public.has_role('admin')
  );

-- order_items â”€ select: via an order the user owns, or staff.
create policy "order_items_select" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.user_id = auth.uid() or public.has_role('store_admin') or public.has_role('admin'))
    )
  );

-- order_items â”€ insert: placed as part of your own order, or staff.
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

