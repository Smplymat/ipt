-- ─────────────────────────────────────────────────────────────────────────────
-- 0010_payment_columns.sql
-- Add payment method, status, and PayMongo reference columns to orders table.
--
-- Run this file in the Supabase SQL Editor (or via `supabase db push`).
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Add payment columns to orders
alter table public.orders
  add column if not exists payment_method text
    check (payment_method in ('cod', 'card', 'gcash', 'paymaya', 'grab_pay')),
  add column if not exists payment_status text
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded'))
    default 'pending',
  add column if not exists paymongo_reference text,
  add column if not exists paid_at timestamptz;

-- 2) Create index for paymongo_reference lookups
create index if not exists idx_orders_paymongo_ref on public.orders (paymongo_reference);

-- 3) Update existing rows to have sensible defaults
update public.orders
set
  payment_method = coalesce(payment_method, 'cod'),
  payment_status = case
    when payment_status = 'pending' and payment_method = 'cod' then 'unpaid'
    else coalesce(payment_status, 'pending')
  end
where payment_method is null or payment_status is null;

-- 4) RLS policies remain the same - staff can update payment status, customers can read their own
-- The existing orders_update policy allows staff to update any field including payment_status
-- Customers can only cancel their own pending orders (handled by existing policy)