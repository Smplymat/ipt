-- ─────────────────────────────────────────────────────────────────────────────
-- verify_connection.sql
--
-- One-shot health check for the Knead to Know Supabase database.
-- Paste into the Supabase SQL editor and run. Every section returns a
-- result set you can read at a glance; nothing is inserted or modified.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. CONNECTION ─────────────────────────────────────────────────────────────
-- Confirms the editor can reach the database and shows the Postgres version.

select
  'connected'                  as status,
  current_database()           as database,
  current_user                 as role,
  version()                    as pg_version,
  now()                        as server_time;


-- ── 2. TABLES ─────────────────────────────────────────────────────────────────
-- Every table that must exist after running the full migration chain.
-- "found" = 1 means the table is present; 0 means it is missing.

select
  t.expected_table                              as table_name,
  (select count(*)::int
     from information_schema.tables s
    where s.table_schema = 'public'
      and s.table_name   = t.expected_table)    as found
from (values
  ('user_roles'),
  ('profiles'),
  ('products'),
  ('categories'),
  ('orders'),
  ('order_items'),
  ('vouchers'),
  ('user_vouchers'),
  ('addresses'),
  ('reviews'),
  ('notifications'),
  ('custom_orders'),
  ('newsletter_subscribers')
) as t(expected_table)
order by table_name;


-- ── 3. ROW COUNTS ────────────────────────────────────────────────────────────
-- Quick sanity check that seed data landed correctly.

select 'products'              as tbl, count(*) as rows from public.products
union all
select 'categories',                   count(*)         from public.categories
union all
select 'vouchers',                     count(*)         from public.vouchers
union all
select 'orders',                       count(*)         from public.orders
union all
select 'order_items',                  count(*)         from public.order_items
union all
select 'reviews',                      count(*)         from public.reviews
union all
select 'user_roles',                   count(*)         from public.user_roles
union all
select 'profiles',                     count(*)         from public.profiles
union all
select 'notifications',                count(*)         from public.notifications
union all
select 'addresses',                    count(*)         from public.addresses
union all
select 'custom_orders',                count(*)         from public.custom_orders
union all
select 'newsletter_subscribers',       count(*)         from public.newsletter_subscribers
order by tbl;


-- ── 4. COLUMNS ───────────────────────────────────────────────────────────────
-- Critical columns added by later migrations (would be missing on a partial run).

select
  c.expected_table                              as table_name,
  c.expected_col                                as column_name,
  (select count(*)::int
     from information_schema.columns col
    where col.table_schema = 'public'
      and col.table_name   = c.expected_table
      and col.column_name  = c.expected_col)    as found
from (values
  ('products',  'stock_quantity'),
  ('orders',    'fulfillment_type'),
  ('orders',    'scheduled_at'),
  ('orders',    'discount'),
  ('orders',    'voucher_code'),
  ('orders',    'voucher_id'),
  ('orders',    'stock_restored')
) as c(expected_table, expected_col)
order by table_name, column_name;


-- ── 5. FUNCTIONS ─────────────────────────────────────────────────────────────
-- All SECURITY DEFINER functions the app calls at runtime.

select
  f.expected_fn                                 as function_name,
  (select count(*)::int
     from pg_catalog.pg_proc   p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname  = 'public'
      and p.proname  = f.expected_fn)            as found
from (values
  ('has_role'),
  ('handle_new_user'),
  ('set_updated_at'),
  ('token_inventory_deduct'),
  ('token_inventory_restock'),
  ('token_inventory_restock_delete'),
  ('token_review_author'),
  ('token_review_refresh'),
  ('token_notify_order'),
  ('token_notify_new_product'),
  ('token_notify_promotion'),
  ('token_notify_custom_order'),
  ('place_order')
) as f(expected_fn)
order by function_name;


-- ── 6. TRIGGERS ──────────────────────────────────────────────────────────────
-- Every trigger with its table and the event(s) it fires on.

select
  trigger_name,
  event_object_table  as on_table,
  event_manipulation  as fires_on,
  action_timing       as timing
from information_schema.triggers
where event_object_schema = 'public'
  and trigger_name in (
    'on_auth_user_created',
    'trg_orders_updated',
    'trg_order_items_deduct_stock',
    'trg_orders_restore_stock',
    'trg_orders_restore_stock_on_delete',
    'trg_orders_notify',
    'trg_reviews_author_name',
    'trg_reviews_refresh_rating',
    'trg_products_notify',
    'trg_vouchers_notify',
    'trg_custom_orders_notify'
  )
order by on_table, trigger_name, fires_on;


-- ── 7. RLS ENABLED ───────────────────────────────────────────────────────────
-- All tables that must have Row Level Security switched on.

select
  r.expected_table                              as table_name,
  (select relrowsecurity::int
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = r.expected_table)         as rls_enabled
from (values
  ('user_roles'),
  ('profiles'),
  ('products'),
  ('categories'),
  ('orders'),
  ('order_items'),
  ('vouchers'),
  ('user_vouchers'),
  ('addresses'),
  ('reviews'),
  ('notifications'),
  ('custom_orders'),
  ('newsletter_subscribers')
) as r(expected_table)
order by table_name;


-- ── 8. RLS POLICIES ──────────────────────────────────────────────────────────
-- Count of policies per table — a zero means the table is unprotected.

select
  tablename   as table_name,
  count(*)    as policy_count
from pg_catalog.pg_policies
where schemaname = 'public'
group by tablename
order by tablename;


-- ── 9. INDEXES ───────────────────────────────────────────────────────────────
-- Performance indexes that should exist after the full migration chain.

select
  i.expected_index                              as index_name,
  (select count(*)::int
     from pg_catalog.pg_indexes idx
    where idx.schemaname = 'public'
      and idx.indexname  = i.expected_index)    as found
from (values
  ('idx_orders_user'),
  ('idx_orders_status'),
  ('idx_orders_scheduled'),
  ('idx_orders_voucher'),
  ('idx_order_items_order'),
  ('idx_user_vouchers_user'),
  ('idx_vouchers_active'),
  ('idx_reviews_product'),
  ('idx_reviews_user'),
  ('idx_addresses_user'),
  ('idx_custom_orders_user'),
  ('idx_notifications_user_read')
) as i(expected_index)
order by index_name;


-- ── 10. STORAGE BUCKET ───────────────────────────────────────────────────────
-- Confirms the product-images bucket exists and is public.

select
  id            as bucket_id,
  name          as bucket_name,
  public        as is_public,
  created_at
from storage.buckets
where id = 'product-images';


-- ── 11. REALTIME PUBLICATION ─────────────────────────────────────────────────
-- The orders table must be in supabase_realtime for live order updates to work.

select
  p.pubname                                     as publication,
  c.relname                                     as table_name
from pg_catalog.pg_publication      p
join pg_catalog.pg_publication_rel  pr on pr.prpubid = p.oid
join pg_catalog.pg_class            c  on c.oid      = pr.prrelid
join pg_catalog.pg_namespace        n  on n.oid      = c.relnamespace
where p.pubname    = 'supabase_realtime'
  and n.nspname    = 'public'
  and c.relname    = 'orders';
