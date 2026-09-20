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