# Code Review — Knead to Know (Angular 22 + Ionic 9 + Supabase)

Reviewed: Sep 2026 (README-only review; no files modified, no SQL executed, nothing committed)

Scope: `src/` front-end + `supabase/migrations/0001-0007` + `supabase/setup.sql` (live schema mirror).
Verification run: `npm run build` (clean), `npm test` (18 passing, 2 files), stray-char scan (clean),
secrets scan (no `.env`, no service-role key committed; anon/publishable key only), migration/SQL audit.

---

## 1. Verdict

**READY FOR THE DEMO / CURRENT LIVE DATABASE — with conditions.**

The live database was built from `supabase/setup.sql`, and every new feature (stock, vouchers,
notifications, reviews, addresses, custom orders, pickup scheduling) is implemented correctly on top of it.
Build, tests, and lint are clean.

However, four issues must be fixed **before the migration chain is ever used to build a new/fresh
database**, and one data-integrity gap (stock restore on delete) applies to the live DB as well:

1. `supabase/migrations/` does **not** reproduce the live schema (drift vs `setup.sql`) — HIGH.
2. Stock is never restored when an order is deleted (live) — HIGH.
3. Order totals / voucher redemption are client-trusted end-to-end (RLS enforces scope, not amounts) — HIGH (accepted-demo caveat).
4. Deleting a review leaves `products.rating` stale — MEDIUM.

---

## 2. Findings (severity order)

| # | Severity | Area | Location | What's wrong | Fix |
|---|----------|------|----------|--------------|-----|
| F1 | HIGH | Migrations | `0002` (products), `0005` (orders); setup.sql:159-161, 365-384, 437-448 | Migration chain ≠ live schema. `products.ingredients / nutritional_value / extra_info` and `orders.fulfillment_type / scheduled_at` + status `ready_for_pickup` exist only in `setup.sql`. `orders_update` policy in `0005` is staff-only; `setup.sql:437-448` adds customer cancel-while-pending. A DB built purely from 0001→0007 rejects checkout inserts (`fulfillment_type` column missing), rejects `ready_for_pickup`, and silently blocks customer cancel. The claim "setup.sql mirrors migrations exactly (no drift)" is FALSE. | Amend 0002/0005 to match `setup.sql`, or ship a `0008` that adds the missing columns/status/policy before any fresh deploy. Live DB is unaffected (built from `setup.sql`). |
| F2 | HIGH | Stock integrity | `0005` orders_delete policy; `0007` restore trigger (only on status='cancelled') | Deleting `orders` (cascade → `order_items`) restores no stock. `orders_delete` additionally lets a row OWNER delete their own order → any customer can silently bleed stock. There is no order-delete UI today, but RLS exposes it via PostgREST. | Add `after delete on orders → restore stock from deleted items`, or remove owner-delete policy. Front-end should also re-check remaining stock at checkout. |
| F3 | HIGH | Pricing/Voucher integrity | `0005` orders_insert (RLS scopes user only); `0006` user_vouchers; checkout.component.ts:342-349 | No server-side recompute of `subtotal/tax/discount/total`; discounts are client-computed and written verbatim. `user_vouchers` self-update lets the owner flip `claimed↔redeemed` freely (no link to an order, no server check). A modified client can place orders with `total=0`/negative values and mark vouchers redeemed without a real order. | Accept as a documented demo limitation, OR add an edge function/DB trigger that re-derives totals and validates voucher redemption against a real order id. |
| F4 | MEDIUM | Stock data loss | `0007` seed block (update products set stock_quantity by name) | Seed re-runs on EVERY execution of 0007 and clobbers live stock for the 6 demo products, despite the "idempotent / safe to re-run" header comment. | Guard with `where stock_quantity = <initial>` or colocate seed with 0004 (do nothing). |
| F5 | MEDIUM | Migrations re-run | `0007` | Header says "Inventory" but file `drop table ... cascade`-recreates `addresses, reviews, notifications, custom_orders, newsletter_subscribers`. Re-running 0007 on a DB that already has these tables = total data loss. | Split table creation into their own one-shot migration; add existence guard. |
| F6 | MEDIUM | Rating staleness | `0007:201-203`, setup.sql:862-864 | Rating refresh trigger is `after insert or update` only; deleting a review (allowed by self-delete RLS) leaves `products.rating` stale (function falls back to `coalesce(..., p.rating)` instead of recomputing). | Also `drop trigger` + add `after delete`: recompute from remaining reviews. |
| F7 | MEDIUM | First-user admin | `0001` handle_new_user + backfill | On a live-ish DB, the OLDEST existing user (by created_at) is promoted to Admin when the migration runs, not necessarily the owner. Future first signups only get Admin when `user_roles` is empty — inconsistent semantics. | Base Admin on the known owner e-mail or rotate an invite; document. |
| F8 | LOW | Restore loophole | `0007` restock trigger | `new.status='cancelled' and old.status is distinct from 'cancelled'` guards double-restore, but staff can `cancelled→pending→cancelled` to restore stock twice (staff-only, low exposure). | Track a dedicated `restored_at`/flag on the order. |
| F9 | LOW | Hygiene | `.gitignore` | Does not exclude `.env` (none exists today). | Add `.env*` to `.gitignore`. |

No box-drawing/emoji corruption found in `src/**/*.ts|html`; no plaintext secrets; tests/build clean.

---

## 3. Module checklist

| Module | Status | Notes |
|--------|--------|-------|
| Auth (sign up / login / routes / guards) | Working | `authGuard`, `staffGuard` verified; 8s safety-valve in `waitForSession()`; role from `user_roles`; admin-only user management gated by `canManageUsers`. |
| Catalog / categories / search | Working | RLS: public read, staff write. Cart caps quantity at `stock_quantity` (cart.service.ts:121-129), `add()` no-ops when out of stock; "Only X left" badges. |
| Cart / checkout | Working (F3 caveat) | Payload matches live schema incl. `fulfillment_type`, `scheduled_at`, `discount`, `voucher_id`. Maps plugin missing ⇒ coords stay `null` and order still places (verified). Empty-cart, loading, error states present. |
| Orders (customer + fulfillment + oversight) | Working on live (F1 caveat) | `orders/`, `order-oversight/`, and admin Orders tab all consume staff-update/`nextStatus` path; statuses incl. `ready_for_pickup` match `STATUS_LABEL/FLOW_PICKUP`; `cancelMyOrder` guarded `eq('status','pending')` + RLS. On a migrations-built DB, `ready_for_pickup` is rejected (see F1). |
| Feedback / reviews | Working (F6 caveat) | Public read + self-write RLS verified; duplicate review → upsert; rating badge tied to `products.rating` (stale on delete). |
| Profile / addresses | Working | Self-scoped RLS (select/insert/update/delete own); validation incl. PH mobile regex; `makeDefault` clears others first. |
| Custom orders | Working | Insert-own + staff-view RLS; notify trigger on insert; form validation (name/phone/description/quantity). |
| Notifications | Working | `subscribe()`/`removeChannel()` cleanup in component + menu; `markRead/markAllRead` optimistic; badge live via realtime; scroll on logout via `reset()`. |
| Promotions / vouchers | Working (F3 caveat) | `claim()` unique (23505) handled; checkout picker filters `status='claimed'`; `findByCode` re-validates active + not expired; redeemed best-effort post-order. |
| Admin (products/categories/users/inventory/orders/sales) | Working | Inventory +/- and explicit set clamps ≥ 0 + integer validation (create/edit); `LOW_STOCK_THRESHOLD` exposed publicly (intended). Sales metrics correct on non-cancelled rows. |

---

## 4. Summary-claim accuracy vs. code

| Claim | Verdict |
|-------|---------|
| "Angular 22 + Ionic v9 + Supabase JS, TypeScript, Vitest" | TRUE (package.json) |
| "Build and existing tests pass; 18 tests / 2 files" | TRUE (verified) |
| "setup.sql mirrors migrations exactly, no drift" | FALSE → F1 |
| "Stock deducted atomically on order, restored on cancel (no oversell)" | TRUE on insert/cancel; FALSE for **delete** → F2 |
| "products.rating recomputed when review is added/edited/deleted" | FALSE for delete → F6 |
| "Maps missing doesn't break the checkout" | TRUE |
| "Every page re-reads data from Supabase and shows error/loading/empty states instead of crashing" | TRUE (verified error signals) |
| "All routes wired to menu entries and valid" | TRUE (routes + staff filter + role guards) |
| "Server validates totals and voucher redemption" | FALSE → F3 |

---

## 5. Safe order of operations to apply 0006 → 0007 on the live DB

Prerequisite check (run in SQL editor before anything else):

```sql
-- Must NOT already exist (they are DROP-CREATED by 0007 → data loss if present)
select to_regclass('public.addresses'), to_regclass('public.reviews'),
       to_regclass('public.notifications'), to_regclass('public.custom_orders'),
       to_regclass('public.newsletter_subscribers'), to_regclass('public.vouchers'),
       to_regclass('public.user_vouchers');
-- All seven must return NULL. If any returns a name → STOP, do not run 0007.
```

Application order (run in order, one script at a time, verify after each):

1. **Backup** — export `orders`, `order_items`, `products`, `categories` (or a full pg_dump) to a file you keep outside the DB.
2. Capture the pre-0007 stock of the 6 demo products (needed to detect F4 clobber):
   ```sql
   select id, name, stock_quantity from public.products
   where name in ('Classic Sourdough','Butter Croissant','Choco Fudge Cake',
                  'Double Choco Cookie','Blueberry Muffin','Cinnamon Roll');
   ```
3. Apply **`supabase/migrations/0006_vouchers.sql`** (adds voucher tables, `orders.discount/voucher_code/voucher_id`). Verify: `select * from public.vouchers limit 1;` and `select column_name from information_schema.columns where table_name='orders';`.
4. Apply **`supabase/migrations/0007_stock_more_tables.sql`** (depends on 0006 vouchers for notify trigger). Verify:
   - `select trigger_name from information_schema.triggers where event_object_table in ('order_items','orders');` shows deduct + restore.
   - Re-check the 6 demo products' stock — if the values you captured in step 2 changed, the seed clobbered stock (see F4).
5. Smoke-test (cf. section 6).

Rollback (if something breaks — reverse order; destructive, so only after a confirmed backup):

```sql
-- undo 0007: drop new tables + triggers (NOT products.stock_quantity, preserve it)
drop table if exists public.newsletter_subscribers, public.custom_orders,
  public.notifications, public.reviews, public.addresses;
drop trigger if exists trg_custom_orders_notify on public.custom_orders;
drop trigger if exists trg_vouchers_notify      on public.vouchers;
drop trigger if exists trg_products_notify      on public.products;
drop trigger if exists trg_orders_notify        on public.orders;
drop trigger if exists trg_reviews_refresh_rating on public.reviews;
drop trigger if exists trg_reviews_author_name    on public.reviews;
drop trigger if exists trg_orders_restore_stock   on public.orders;
drop trigger if exists trg_order_items_deduct_stock on public.order_items;
drop function if exists public.token_notify_custom_order, public.token_notify_voucher,
  public.token_notify_product, public.token_notify_order,
  public.token_reviews_refresh_rating, public.token_reviews_author_name,
  public.token_inventory_restock, public.token_inventory_deduct;
-- undo 0006 (only if you also remove the orders columns first, else FK blocks it):
alter table public.orders drop column if exists voucher_id;
alter table public.orders drop column if exists voucher_code;
alter table public.orders drop column if exists discount;
drop table if exists public.user_vouchers, public.vouchers;
```

---

## 6. Manual test script

Prereqs: one signed-in customer (email confirmed), one `store_admin`, one `admin`; two products with known stock (e.g. Sourdough=2, Croissant=10).

Stock / oversell protection
1. Customer adds 2× Sourdough to cart → checkout → place order. Expect: success; `products.stock_quantity` for Sourdough = 0.
2. With Sourdough at 0, catalog shows sold out / cart `add()` blocked (verify "Add" disabled or no increment).
3. From a second browser, add 1× Croissant while staff simultaneously advances an existing Croissant order — place order; one must fail with a stock error; stock must never go negative.
4. Verify DB: `select stock_quantity from products where name='Butter Croissant';` matches items placed.

Cancel restore
5. Customer cancels their own order **while pending** → stock for those items returns exactly once.
6. Staff re-cancels an already-cancelled order → stock unchanged (no double restore).
7. Customer deletes an order via RLS (raw SQL/Postman) → **stock does NOT return** (documents F2).

Pickup / ready flow (live DB only)
8. Customer places a **pickup** order with a scheduled time → advanced by staff pending→preparing→**ready_for_pickup**→delivered; verify each step updates in customer's Orders page live (realtime badge), order-oversight, and admin Orders tab; status chip color changes.

Vouchers
9. On Promotions page, claim promo code → the code now shows "claimed"; duplicate claim shows "already claimed" error.
10. Checkout a qualifying cart with the claimed voucher → discount reflects; after placing, voucher shows redeemed in wallet.
11. Apply an expired voucher code → rejected with error.

Reviews
12. Post a 5-star review on a product → product rating badge updates.
13. Delete your review → verify `products.rating` does **not** update (documents F6).

Notifications (realtime)
14. Customer places an order → customer receives "order confirmed" in `/notifications`; menu badge increments.
15. Staff advances status → customer gets "order update" live without refresh; opening it marks it read; "Mark all read" zeros the badge.
16. Customer submits a custom order → admin receives a notification; opening it navigates to the right page.

Auth / role integrity
17. Customer cannot open `/admin` or `/order-oversight` (redirected to dashboard); `store_admin` can open both but sees no Users tab; `admin` sees and can reassign roles; the last-few role changes persist after logout/login.
18. In Flight Mode, reload a page → error/loading state is shown, app does not white-screen; returning online and retrying recovers.