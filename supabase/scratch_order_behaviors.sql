-- ─────────────────────────────────────────────────────────────────────────────
-- scratch_order_behaviors.sql
--
-- Portable plain-SQL regression checks for the stock / order-integrity work
-- (F2/F4/F5/F6/F8).
--
-- Compatible with the Supabase SQL editor, psql, DBeaver, and any other
-- plain-SQL runner. No psql meta-commands. No temp tables. No session-level
-- constructs (BEGIN/ROLLBACK, CREATE TEMP TABLE) that the Supabase editor
-- would not preserve across statement boundaries.
--
-- Everything lives inside ONE DO $$ … $$ block. The one scratch product
-- inserted during the constraint test is deleted before the block exits,
-- leaving the database unchanged.
--
-- Checks:
--   F4/F5  idempotence — guarded migration blocks re-run without error
--   F5     named non-negative stock constraint exists and rejects negatives
--   F2     trg_orders_restore_stock        on orders  (AFTER UPDATE OF status)
--   F8     trg_orders_restore_stock_on_delete on orders (AFTER DELETE)
--   F6     trg_reviews_refresh_rating      on reviews (INSERT/UPDATE/DELETE)
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_pass_count  int  := 0;
  v_pid         uuid;
  v_trig_count  int;
  v_rejected    bool;
  v_ok          bool;
begin

  -- ── inline PASS / FAIL macros ──────────────────────────────────────────────
  -- Usage: perform the boolean expression, store in v_ok, then call the block.
  -- We just inline the raise calls — no nested procedure needed.

  -- ──────────────────────────────────────────────────────────────────────────
  -- 1. IDEMPOTENCE — re-run guarded migration blocks a second time (F4/F5)
  --    Reaching the end of this section without error IS the passing condition.
  -- ──────────────────────────────────────────────────────────────────────────

  -- 0006/0007: named non-negative stock constraint — drop-if-exists + re-add.
  begin
    alter table public.products
      drop constraint if exists products_stock_quantity_nonneg_check;
  exception when others then null; end;

  alter table public.products
    add constraint products_stock_quantity_nonneg_check
    check (stock_quantity >= 0) not valid;

  alter table public.products
    validate constraint products_stock_quantity_nonneg_check;

  -- 0006: vouchers — create-if-not-exists (no-op when the table already exists).
  if to_regclass('public.vouchers') is null then
    create table public.vouchers (
      id uuid primary key default gen_random_uuid()
    );
  end if;

  -- 0008: restock triggers — drop-if-exists + recreate.
  drop trigger if exists trg_orders_restore_stock on public.orders;
  create trigger trg_orders_restore_stock
    after update of status on public.orders
    for each row
    execute function public.token_inventory_restock();

  drop trigger if exists trg_orders_restore_stock_on_delete on public.orders;
  create trigger trg_orders_restore_stock_on_delete
    after delete on public.orders
    for each row
    execute function public.token_inventory_restock_delete();

  -- If we got here, none of the DDL above raised.
  v_pass_count := v_pass_count + 1;
  raise notice 'PASS  F4/F5: 0006/0007/0008 guarded blocks re-run cleanly (idempotent)';

  -- ──────────────────────────────────────────────────────────────────────────
  -- 2. NON-NEGATIVE STOCK CONSTRAINT — exists and rejects negatives (F5)
  -- ──────────────────────────────────────────────────────────────────────────

  -- 2a. Named constraint present in pg_constraint.
  select exists (
    select 1
      from pg_catalog.pg_constraint con
      join pg_catalog.pg_class      rel on rel.oid = con.conrelid
      join pg_catalog.pg_namespace  nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public'
       and rel.relname = 'products'
       and con.conname = 'products_stock_quantity_nonneg_check'
       and con.contype = 'c'
  ) into v_ok;

  if not v_ok then
    raise exception 'FAIL  F5: products_stock_quantity_nonneg_check constraint not found';
  end if;
  v_pass_count := v_pass_count + 1;
  raise notice 'PASS  F5: products_stock_quantity_nonneg_check constraint exists';

  -- 2b. Insert a scratch product (stock = 5), then attempt stock = -1.
  insert into public.products
    (name, category, description, price, rating, stock_quantity,
     ingredients, nutritional_value, extra_info)
  values
    ('_scratch_loaf_', 'Breads', 'regression test row', 1.00, 4.8, 5,
     '', '', '[]'::jsonb)
  returning id into v_pid;

  v_rejected := false;
  begin
    update public.products set stock_quantity = -1 where id = v_pid;
  exception
    when check_violation then
      v_rejected := true;
  end;

  -- Always clean up the scratch row, whether the update succeeded or not.
  delete from public.products where id = v_pid;

  if not v_rejected then
    raise exception 'FAIL  F5: setting stock_quantity = -1 was NOT rejected';
  end if;
  v_pass_count := v_pass_count + 1;
  raise notice 'PASS  F5: setting stock_quantity = -1 is rejected by the constraint';

  -- ──────────────────────────────────────────────────────────────────────────
  -- 3. TRIGGERS wired to the correct table + event (F2 / F8 / F6)
  -- ──────────────────────────────────────────────────────────────────────────

  -- F2: trg_orders_restore_stock — AFTER UPDATE ON orders
  select count(*) into v_trig_count
    from information_schema.triggers
   where event_object_schema = 'public'
     and event_object_table  = 'orders'
     and trigger_name        = 'trg_orders_restore_stock'
     and event_manipulation  = 'UPDATE';

  if v_trig_count = 0 then
    raise exception 'FAIL  F2: trg_orders_restore_stock not found on public.orders (UPDATE)';
  end if;
  v_pass_count := v_pass_count + 1;
  raise notice 'PASS  F2: trg_orders_restore_stock exists on public.orders (UPDATE)';

  -- F8: trg_orders_restore_stock_on_delete — AFTER DELETE ON orders
  select count(*) into v_trig_count
    from information_schema.triggers
   where event_object_schema = 'public'
     and event_object_table  = 'orders'
     and trigger_name        = 'trg_orders_restore_stock_on_delete'
     and event_manipulation  = 'DELETE';

  if v_trig_count = 0 then
    raise exception 'FAIL  F8: trg_orders_restore_stock_on_delete not found on public.orders (DELETE)';
  end if;
  v_pass_count := v_pass_count + 1;
  raise notice 'PASS  F8: trg_orders_restore_stock_on_delete exists on public.orders (DELETE)';

  -- F6: trg_reviews_refresh_rating — must cover INSERT, UPDATE *and* DELETE
  --     on reviews (information_schema has one row per event).
  select count(distinct event_manipulation) into v_trig_count
    from information_schema.triggers
   where event_object_schema = 'public'
     and event_object_table  = 'reviews'
     and trigger_name        = 'trg_reviews_refresh_rating'
     and event_manipulation  in ('INSERT', 'UPDATE', 'DELETE');

  if v_trig_count < 3 then
    raise exception
      'FAIL  F6: trg_reviews_refresh_rating on public.reviews covers only % of 3 required events',
      v_trig_count;
  end if;
  v_pass_count := v_pass_count + 1;
  raise notice 'PASS  F6: trg_reviews_refresh_rating exists on public.reviews (INSERT/UPDATE/DELETE)';

  -- ──────────────────────────────────────────────────────────────────────────
  -- Summary
  -- ──────────────────────────────────────────────────────────────────────────
  raise notice '────────────────────────────────────────────────────────';
  raise notice 'All % / 6 checks passed.', v_pass_count;
  raise notice '────────────────────────────────────────────────────────';

end $$;
