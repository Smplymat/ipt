-- ─────────────────────────────────────────────────────────────────────────────
-- 0012_fix_payment_methods.sql
-- Fix payment_method and payment_status constraints to match PayMongo integration.
-- The place_order() function and edge functions need consistent values.
-- ─────────────────────────────────────────────────────────────────────────────

-- 00) Drop the OLD check constraints first. The original ones (from 0005) only
-- allow ('cod','online') and ('pending','paid','failed'), so they would reject
-- the data fix below. The new constraints are added back in steps 1 and 2.
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders drop constraint if exists orders_payment_status_check;

-- 0) Map old payment_method values to new PayMongo-compatible values
-- Run this BEFORE adding the new constraint to fix existing data
-- ('online' was the original non-COD value from 0005; the exact method used is
--  unknown for those old orders, so they are mapped to 'card'.)
update public.orders
set payment_method = case
  when payment_method in ('credit_card', 'debit_card', 'paypal', 'online') then 'card'
  when payment_method = 'cash' then 'cod'
  else payment_method
end
where payment_method in ('credit_card', 'debit_card', 'paypal', 'online', 'cash');

-- Anything still outside the allowed list would make the new constraint fail.
update public.orders
set payment_method = 'cod'
where payment_method is not null
  and payment_method not in ('cod', 'card', 'gcash', 'paymaya', 'grab_pay');

-- 1) Update orders.payment_method check constraint to include all PayMongo methods
-- Drop and recreate with all valid methods
alter table public.orders
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('cod', 'card', 'gcash', 'paymaya', 'grab_pay'));

-- 2) Update orders.payment_status check constraint to include all statuses
-- Drop and recreate with all valid statuses
alter table public.orders
  drop constraint if exists orders_payment_status_check;

alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded'));

-- 3) Ensure paymongo_reference column exists (added in 0010, but safe to re-add)
alter table public.orders
  add column if not exists paymongo_reference text;

-- 4) Ensure paid_at column exists
alter table public.orders
  add column if not exists paid_at timestamptz;

-- 5) Create index for paymongo_reference lookups (idempotent)
create index if not exists idx_orders_paymongo_ref on public.orders (paymongo_reference);

-- 6) Update existing rows to have correct defaults
update public.orders
set
  payment_method = coalesce(payment_method, 'cod'),
  payment_status = case
    when payment_method = 'cod' then 'unpaid'
    when payment_status = 'pending' and payment_method = 'online' then 'pending'
    when payment_status = 'paid' then 'paid'
    else coalesce(payment_status, 'unpaid')
  end
where payment_method is null or payment_status is null;

-- 7) Fix the place_order() function to use correct payment_method values and payment_status
-- The function should accept the same payment_method values as the edge function
-- and set payment_status correctly: 'unpaid' for COD, 'pending' for online methods
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
  v_user_id           uuid := auth.uid();
  v_fulfillment       text;
  v_address           text;
  v_unit_notes        text;
  v_lat               double precision;
  v_lng               double precision;
  v_payment_status    text;
  v_line              record;
  v_product           record;
  v_subtotal          numeric(10,2) := 0;
  v_eligible          numeric(10,2) := 0;
  v_delivery_fee      numeric(10,2);
  v_discount          numeric(10,2) := 0;
  v_voucher_id        uuid;
  v_voucher_code      text;
  -- Scalar voucher fields (populated only when a promo code is provided)
  v_voucher_discount_type      text;
  v_voucher_discount_value     numeric(10,2);
  v_voucher_minimum_spend      numeric(10,2);
  v_voucher_max_discount       numeric(10,2);
  v_voucher_eligible_categories text[];
  v_raw_discount       numeric(10,2);
  v_taxable            numeric(10,2);
  v_tax                numeric(10,2);
  v_total              numeric(10,2);
  v_order              public.orders;
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

  -- Accept all PayMongo payment methods
  if p_payment_method not in ('cod', 'card', 'gcash', 'paymaya', 'grab_pay') then
    raise exception 'Invalid payment method.';
  end if;

  -- COD = unpaid (will be paid on delivery), online methods = pending (awaiting PayMongo)
  v_payment_status := case when p_payment_method = 'cod' then 'unpaid' else 'pending' end;

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
    select v.discount_type, v.discount_value, v.minimum_spend, v.max_discount, v.eligible_categories, v.id, v.code
      into v_voucher_discount_type, v_voucher_discount_value, v_voucher_minimum_spend, v_voucher_max_discount, v_voucher_eligible_categories, v_voucher_id, v_voucher_code
      from public.vouchers v
     where upper(v.code) = upper(btrim(p_promo_code))
       and v.active
       and (v.starts_at is null or v.starts_at <= now())
       and (v.expires_at is null or v.expires_at > now());

    if not found then
      raise exception 'Invalid or expired promo code.';
    end if;

    if exists (
      select 1 from public.user_vouchers uv
       where uv.user_id = v_user_id
         and uv.voucher_id = v_voucher_id
         and uv.status = 'redeemed'
    ) then
      raise exception 'This voucher has already been redeemed.';
    end if;
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

    -- Improved validation: check for null, non-integer, zero, or negative qty
    if v_line.qty is null then
      raise exception 'Quantity is missing for %. Please remove and re-add the item.', v_product.name;
    end if;

    if v_line.qty <= 0 then
      raise exception 'Quantity for % must be at least 1.', v_product.name;
    end if;

    if v_line.qty != floor(v_line.qty) then
      raise exception 'Quantity for % must be a whole number.', v_product.name;
    end if;

    -- Check stock availability
    if v_product.stock_quantity is null or v_product.stock_quantity < v_line.qty then
      raise exception 'Only % %s left in stock. Please reduce the quantity or choose another item.',
        v_product.stock_quantity, v_product.name;
    end if;

    v_subtotal := v_subtotal + v_product.price * v_line.qty;

    -- Add to voucher-eligible subtotal if a voucher is active and category matches
    if v_voucher_id is not null
       and (v_voucher_eligible_categories is null
            or array_length(v_voucher_eligible_categories, 1) is null
            or v_product.category = any (v_voucher_eligible_categories)) then
      v_eligible := v_eligible + v_product.price * v_line.qty;
    end if;
  end loop;

  -- Delivery fee: ₱60 waived at ₱500+; pickup is always free.
  v_delivery_fee := case
    when v_fulfillment = 'delivery' and v_subtotal < 500 then 60
    else 0
  end;

  -- Voucher discount (only if a voucher was provided and validated)
  if v_voucher_id is not null then
    if v_eligible <= 0 then
      raise exception 'The promo code does not apply to anything in your basket.';
    end if;
    if v_eligible < v_voucher_minimum_spend then
      raise exception 'Spend ₱% or more to apply this promo code.',
        to_char(v_voucher_minimum_spend, '999,999.99');
    end if;

    v_raw_discount := case
      when v_voucher_discount_type = 'percent'
        then v_eligible * v_voucher_discount_value / 100
      else v_voucher_discount_value
    end;
    if v_voucher_max_discount is not null then
      v_raw_discount := least(v_raw_discount, v_voucher_max_discount);
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

-- Ensure execute permission is granted to authenticated users only
revoke execute on function public.place_order(
  text, text, text, text, text, double precision, double precision,
  timestamptz, text, jsonb, text
) from public, anon;
grant execute on function public.place_order(
  text, text, text, text, text, double precision, double precision,
  timestamptz, text, jsonb, text
) to authenticated;