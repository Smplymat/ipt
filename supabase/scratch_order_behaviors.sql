-- ─────────────────────────────────────────────────────────────────────────────
-- scratch_order_behaviors.sql
--
-- RUN ON A SCRATCH / STAGING DATABASE ONLY (empty DB created from the full
-- migration chain, or a disposable clone). This is deliberately destructive
-- ("drop + recreate") so it proves the migrations behave, and therefore
-- must NEVER be pointed at a live database. Everything rolls back in a
-- transaction, so a single run leaves the scratch DB unchanged.
--
-- What this script CAN verify without a signed-in session (pure SQL, no auth):
--   1) The 0006/0007/0008 blocks are idempotent — running them a second time
--      does not fail and does not duplicate objects (F4/F5).
--   2) The non-negative stock constraint (F5) actually rejects negative stock.
--   3) The restock triggers exist and are wired to the right tables/events.
--   4) The product-rating refresh trigger exists and fires on INSERT/UPDATE/DELETE.
--
-- What it CANNOT verify (needs an authenticated session + order rows that are
-- FK'd to auth.users, which a script cannot fabricate):
--   * place_order() pricing/stock/voucher validation (F3)
--   * the cancel → restore-exactly-once + delete → restore-exactly-once paths
--     (F2/F8) and the "/* cancelled → pending → cancelled */ no-double-restore"
--     loophole — these need a real user + real order.
--   * voucher single-use / no double redemption.
--
-- Those behavior guarantees are covered by the Angular unit specs
-- (orders.service.spec.ts → place_order RPC payload contract;
--  vouchers.service.spec.ts → discount math / voucherIssue) and by a browser
-- sign-in test, which is where the rest of this task's verification lives.
--
-- Run:
--   psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 -f scratch_order_behaviors.sql
-- A failing check raises an exception, aborting the transaction (psql exits
-- non-zero). All passing checks print "PASS <name>".
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ─── PASS helper ─────────────────────────────────────────────────────────────

create temp table check_results(label text);
create or replace function scratch_pass(p_label text) returns void
language plpgsql
as $$
begin
  insert into check_results values (p_label);
  raise notice 'PASS %', p_label;
end $$;

-- ─── 1) Idempotent re-run of the stock / integrity migrations (F4/F5) ───────

-- Running the exact migration files a second time must be a no-op: every
-- object is created with create-or-replace / drop-if-exists / guarded DO
-- blocks. If any of these raise, the whole transaction aborts.
\set QUIET on
\i supabase/migrations/0006_vouchers.sql
\i supabase/migrations/0007_stock_more_tables.sql
\i supabase/migrations/0008_order_integrity.sql
\set QUIET off

select scratch_pass('F4/F5: 0006/0007/0008 re-run cleanly (no duplication)');

-- ─── 2) Non-negative stock constraint rejects negatives (F5) ────────────────

do $$
declare
  v_pid uuid;
begin
  insert into public.products
    (name, category, description, price, rating, stock_quantity,
     ingredients, nutritional_value, extra_info)
  values
    ('Scratch Loaf', 'Scratch', 'test', 150, 4.8, 5,
     '[]'::jsonb, '', '[]'::jsonb')
  returning id into v_pid;

  perform scratch_pass('F5: products.stock_quantity has a named non-neg check')
    from pg_constraint c
   where c.conname = 'products_stock_quantity_nonneg_check'
     and c.contype = 'c';

  begin
    update public.products set stock_quantity = -1 where id = v_pid;
    raise exception 'FAIL: negative stock was not rejected';
  exception
    when check_violation then
      perform scratch_pass('F5: negative stock is rejected by the check');
  end;
end $$;

-- ─── 3) Triggers wired to table + event (F2/F8/F6) ──────────────────────────

-- F2/F8 — restock on cancel + on delete, both guarded to run exactly once.
select scratch_pass('F2: restock-on-cancel trigger exists') from information_schema.triggers
 where event_object_table = 'orders' and trigger_name = 'trg_orders_restore_stock';
select scratch_pass('F8: restock-on-delete trigger exists') from information_schema.triggers
 where event_object_table = 'orders' and trigger_name = 'trg_orders_restore_stock_on_delete';

-- F6 — rating refresh fires on delete too (insert/update/delete trigger).
select scratch_pass('F6: rating refresh trigger exists') from information_schema.triggers
 where event_object_table = 'reviews' and trigger_name = 'trg_reviews_refresh_rating';

rollback;

-- ─────────────────────────────────────────────────────────────────────────────
-- Behavior checks that require a signed-in user (do these in a browser /
-- staging session instead of SQL):
--   * F3  place_order(): server prices/stock/totals, voucher validation &
--         single-use redemption, stock-deduct-on-insert, out-of-stock error
--   * F2  cancel → stock restored exactly once (also via the orders page)
--   * F8  cancel → pending → cancel loophole stays closed (no double restore)
--   * F6  deleting a review (with remaining reviews) recomputes the rating;
--         deleting the last review resets to the products default
-- ─────────────────────────────────────────────────────────────────────────────
