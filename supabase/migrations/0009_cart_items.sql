-- ─────────────────────────────────────────────────────────────────────────────
-- 0009_cart_items.sql
-- Persistent server-side cart for logged-in users.
-- Guest carts remain in localStorage (client-only) and are merged on login.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) cart_items : one row per product in a user's cart
create table if not exists public.cart_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete cascade,
  quantity        integer not null check (quantity > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, product_id)
);

-- 2) Indexes
create index if not exists idx_cart_items_user on public.cart_items (user_id);

-- 3) updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_cart_items_updated on public.cart_items;
create trigger trg_cart_items_updated
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- 4) Row Level Security
alter table public.cart_items enable row level security;

-- Users can only see/modify their own cart rows
drop policy if exists "cart_items: select own" on public.cart_items;
create policy "cart_items: select own"
  on public.cart_items for select
  using (user_id = auth.uid());

drop policy if exists "cart_items: insert own" on public.cart_items;
create policy "cart_items: insert own"
  on public.cart_items for insert
  with check (user_id = auth.uid());

drop policy if exists "cart_items: update own" on public.cart_items;
create policy "cart_items: update own"
  on public.cart_items for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "cart_items: delete own" on public.cart_items;
create policy "cart_items: delete own"
  on public.cart_items for delete
  using (user_id = auth.uid());

-- Staff can view all carts (for support/debugging)
drop policy if exists "cart_items: staff select" on public.cart_items;
create policy "cart_items: staff select"
  on public.cart_items for select
  using (public.has_role('store_admin') or public.has_role('admin'));

-- 5) Helper RPC: atomic upsert for cart items (insert or increment quantity)
create or replace function public.upsert_cart_item(
  p_user_id uuid,
  p_product_id uuid,
  p_quantity integer
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_max_stock integer;
begin
  -- Validate stock
  select stock_quantity into v_max_stock from public.products where id = p_product_id;
  if v_max_stock is null then
    raise exception 'Product not found.';
  end if;
  if v_max_stock = 0 then
    raise exception 'Product is sold out.';
  end if;
  if p_quantity > v_max_stock then
    raise exception 'Not enough stock. Only % available.', v_max_stock;
  end if;

  insert into public.cart_items (user_id, product_id, quantity)
  values (p_user_id, p_product_id, p_quantity)
  on conflict (user_id, product_id) do update
    set quantity = least(public.cart_items.quantity + excluded.quantity, v_max_stock),
        updated_at = now();
end $$;

grant execute on function public.upsert_cart_item(uuid, uuid, integer) to authenticated;

-- 6) Realtime: broadcast cart changes so other tabs/devices update live
do $$
begin
  begin
    alter publication supabase_realtime add table public.cart_items;
  exception when others then
    null; -- already a member of the publication
  end;
end $$;