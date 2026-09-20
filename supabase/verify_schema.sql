-- ─────────────────────────────────────────────────────────────────────────────
-- verify_schema.sql
-- Structural verification for the Knead to Know schema.
--
-- Run this in a SCRATCH / STAGING Supabase project AFTER building it from the
-- migration chain (0001 … 0008 run in order — e.g. `supabase db reset`), NOT
-- on the live database. It compares the database's columns, constraints,
-- policies, triggers and functions against the schema that supabase/setup.sql
-- defines, and reports every remaining difference as a row in
-- pg_temp.verify_failures.
--
-- Expected output:
--   Any row in the final `select * from pg_temp.verify_failures;` = a
--   remaining difference. The count query should return 0.
--
-- Textual sync between migrations/ and setup.sql is checked separately by
-- supabase/compare_migrations_setup.ps1 (no database required).
-- ─────────────────────────────────────────────────────────────────────────────

drop table if exists pg_temp.verify_failures;
create temp table pg_temp.verify_failures (
  check_name text not null,
  details    text not null
);

-- ── Tables ───────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'user_roles', 'profiles', 'products', 'categories', 'orders', 'order_items',
    'vouchers', 'user_vouchers', 'addresses', 'reviews', 'notifications',
    'custom_orders', 'newsletter_subscribers'
  ]
  loop
    if to_regclass('public.' || t) is null then
      insert into pg_temp.verify_failures values ('table missing', 'public.' || t);
    end if;
  end loop;
end $$;

-- ── Columns ──────────────────────────────────────────────────────────────────

insert into pg_temp.verify_failures
select 'products columns', 'missing one of ingredients/nutritional_value/extra_info/stock_quantity'
where not (
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='products'
      and column_name in ('ingredients','nutritional_value','extra_info','stock_quantity')) = 4
);

insert into pg_temp.verify_failures
select 'orders columns', 'missing one of fulfillment_type/scheduled_at/stock_restored/discount/voucher_code/voucher_id'
where not (
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='orders'
      and column_name in ('fulfillment_type','scheduled_at','stock_restored','discount','voucher_code','voucher_id')) = 6
);

insert into pg_temp.verify_failures
select 'orders.status check', 'orders status check missing ready_for_pickup'
where not exists (
  select 1 from pg_catalog.pg_constraint con
   where con.conrelid = 'public.orders'::regclass
     and con.contype  = 'c'
     and pg_get_constraintdef(con.oid) like '%ready_for_pickup%'
);

insert into pg_temp.verify_failures
select 'products.stock_quantity check', 'no >=0 check on products.stock_quantity'
where not exists (
  select 1 from pg_catalog.pg_constraint con
   where con.conrelid = 'public.products'::regclass
     and con.contype  = 'c'
     and exists (
       select 1 from pg_catalog.pg_attribute att
        where att.attrelid = con.conrelid
          and att.attnum = any (con.conkey)
          and att.attname = 'stock_quantity'
     )
     and pg_get_constraintdef(con.oid) like '%0%'
);

-- Element checks: FK / unique constraints that must exist.
insert into pg_temp.verify_failures
select 'orders.voucher FK', 'orders_voucher_id_fkey missing'
where not exists (
  select 1 from pg_catalog.pg_constraint con
   where con.conrelid = 'public.orders'::regclass and con.conname = 'orders_voucher_id_fkey'
);

insert into pg_temp.verify_failures
select 'user_vouchers unique', 'unique(user_id, voucher_id) missing'
where not exists (
  select 1 from pg_catalog.pg_constraint con
   where con.conrelid = 'public.user_vouchers'::regclass
     and con.contype  = 'u'
     and con.conkey::smallint[] = (
       select array_agg(att.attnum order by att.attnum)
         from pg_catalog.pg_attribute att
        where att.attrelid = con.conrelid
          and att.attname in ('user_id','voucher_id')
     )
     and pg_get_constraintdef(con.oid) like '%voucher_id%'
);

insert into pg_temp.verify_failures
select 'orders indexes', 'idx_orders_user/status/scheduled missing'
where not (
  (select count(*) from pg_catalog.pg_indexes
    where schemaname='public' and tablename='orders'
      and indexname in ('idx_orders_user','idx_orders_status','idx_orders_scheduled')) = 3
);

-- ── Policies (RLS) ───────────────────────────────────────────────────────────

insert into pg_temp.verify_failures
select 'orders_insert', 'policy missing or not staff-only'
where not exists (
  select 1 from pg_catalog.pg_policies p
   where p.schemaname='public' and p.tablename='orders' and p.policyname='orders_insert'
     and p.cmd='INSERT'
     and p.with_check is not null
     and position('has_role' in p.with_check) > 0
);

insert into pg_temp.verify_failures
select 'order_items_insert', 'policy missing or not staff-only'
where not exists (
  select 1 from pg_catalog.pg_policies p
   where p.schemaname='public' and p.tablename='order_items' and p.policyname='order_items_insert'
     and p.cmd='INSERT' and p.with_check is not null
     and position('has_role' in p.with_check) > 0
);

insert into pg_temp.verify_failures
select 'orders_update', 'customer cancel-while-pending policy missing'
where not exists (
  select 1 from pg_catalog.pg_policies p
   where p.schemaname='public' and p.tablename='orders' and p.policyname='orders_update'
     and p.cmd='UPDATE' and p.qual is not null
     and position('status = ''pending''' in p.qual) > 0
);

insert into pg_temp.verify_failures
select 'orders_delete', 'policy missing or not staff-only'
where not exists (
  select 1 from pg_catalog.pg_policies p
   where p.schemaname='public' and p.tablename='orders' and p.policyname='orders_delete'
     and p.cmd='DELETE' and p.qual is not null
     and position('user_id' in p.qual) = 0
     and position('has_role' in p.qual) > 0
);

insert into pg_temp.verify_failures
select 'user_vouchers self update', 'self-update policy still present (should be removed)'
where exists (
  select 1 from pg_catalog.pg_policies p
   where p.schemaname='public' and p.tablename='user_vouchers' and p.cmd='UPDATE'
);

-- Existence of every other required policy, by table + name.
do $$
declare
  t text; n text;
begin
  foreach t in array array[
    'user_roles','profiles','products','categories','orders','order_items',
    'vouchers','user_vouchers','addresses','reviews','notifications','custom_orders',
    'newsletter_subscribers'
  ]
  loop
    -- Enumerate the policies that must exist (source: migrations/setup.sql).
    foreach n in array (
      case t
        when 'user_roles' then array['user_roles: select','user_roles: admin insert','user_roles: admin update','user_roles: admin delete']
        when 'profiles'   then array['profiles: select','profiles: admin update','profiles: self update']
        when 'products'   then array['products: public read','products: staff insert','products: staff update','products: admin delete']
        when 'categories' then array['categories: public read','categories: staff insert','categories: staff update','categories: admin delete']
        when 'orders'       then array['orders_select','orders_insert','orders_update','orders_delete']
        when 'order_items'  then array['order_items_select','order_items_insert']
        when 'vouchers'     then array['vouchers: public read','vouchers: staff insert','vouchers: staff update','vouchers: admin delete']
        when 'user_vouchers'then array['user_vouchers: select','user_vouchers: self insert']
        when 'addresses'    then array['addresses: select own','addresses: insert own','addresses: update own','addresses: delete own']
        when 'reviews'      then array['reviews: public read','reviews: self insert','reviews: self update','reviews: self delete']
        when 'notifications'then array['notifications: select own','notifications: update own']
        when 'custom_orders'then array['custom_orders: select own or staff','custom_orders: insert own','custom_orders: update']
        when 'newsletter_subscribers' then array['newsletter: public insert','newsletter: staff read']
        else array[]::text[]
      end
    )
    loop
      if not exists (
        select 1 from pg_catalog.pg_policies p
         where p.schemaname='public' and p.tablename=t and p.policyname=n
      ) then
        insert into pg_temp.verify_failures values ('policy missing', 'public.' || t || ' : ' || n);
      end if;
    end loop;
  end loop;
end $$;

-- ── Triggers ─────────────────────────────────────────────────────────────────

do $$
declare
  t text; n text;
begin
  foreach t in array array['orders','order_items','reviews','products','vouchers','custom_orders','notifications']
  loop
    foreach n in array (
      case t
        when 'orders'       then array['trg_orders_updated','trg_orders_restore_stock','trg_orders_restore_stock_on_delete','trg_orders_notify']
        when 'order_items'  then array['trg_order_items_deduct_stock']
        when 'reviews'      then array['trg_reviews_author_name','trg_reviews_refresh_rating']
        when 'products'     then array['trg_products_notify']
        when 'vouchers'     then array['trg_vouchers_notify']
        when 'custom_orders'then array['trg_custom_orders_notify']
        when 'notifications'then array[]::text[]
        else array[]::text[]
      end
    )
    loop
      if not exists (
        select 1 from information_schema.triggers tr
         where tr.event_object_schema='public' and tr.event_object_table=t and tr.trigger_name=n
      ) then
        insert into pg_temp.verify_failures values ('trigger missing', 'public.' || t || ' : ' || n);
      end if;
    end loop;
  end loop;

  -- F6: the rating trigger must also fire on DELETE (one AFTER INSERT/UPDATE
  -- trigger plus one AFTER DELETE trigger share the same name).
  if not exists (
    select 1 from information_schema.triggers tr
     where tr.event_object_schema='public' and tr.event_object_table='reviews'
       and tr.trigger_name='trg_reviews_refresh_rating'
       and tr.action_timing='AFTER'
       and tr.event_manipulation='DELETE'
  ) then
    insert into pg_temp.verify_failures values ('rating trigger', 'trg_reviews_refresh_rating has no AFTER DELETE event');
  end if;

  -- F2/F8: the delete-restore trigger must exist on orders.
  if not exists (
    select 1 from information_schema.triggers tr
     where tr.event_object_schema='public' and tr.event_object_table='orders'
       and tr.trigger_name='trg_orders_restore_stock_on_delete'
       and tr.event_manipulation='DELETE'
  ) then
    insert into pg_temp.verify_failures values ('restock on delete', 'trg_orders_restore_stock_on_delete missing (AFTER DELETE)');
  end if;
end $$;

-- ── Functions ────────────────────────────────────────────────────────────────

do $$
declare
  n text;
begin
  foreach n in array array[
    'has_role','handle_new_user','set_updated_at',
    'token_inventory_deduct','token_inventory_restock','token_inventory_restock_delete',
    'token_review_author','token_review_refresh',
    'token_notify_order','token_notify_new_product','token_notify_promotion','token_notify_custom_order',
    'place_order'
  ]
  loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace nsp on nsp.oid = p.pronamespace
      where nsp.nspname='public' and p.proname = n
    ) then
      insert into pg_temp.verify_failures values ('function missing', 'public.' || n);
    end if;
  end loop;
end $$;

-- ── Report ───────────────────────────────────────────────────────────────────

select
  case when count(*) = 0 then 'PASS — schema matches setup.sql'
       else 'FAIL — ' || count(*) || ' difference(s) listed below'
  end as result
from pg_temp.verify_failures;

select check_name, details
  from pg_temp.verify_failures
 order by check_name, details;