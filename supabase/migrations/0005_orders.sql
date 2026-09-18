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
-- Status flow (driven by staff in the Fulfillment view):
--   pending → preparing → out_for_delivery → delivered     (cancelled anytime)
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

-- orders ─ update: staff only (status / payment tracking).
create policy "orders_update" on public.orders
  for update using (
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