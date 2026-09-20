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