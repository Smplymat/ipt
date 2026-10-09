# Knead to Know — Artisan Bakery Ordering App

Built with **Angular 22** + **Ionic 9** + **Supabase** (PostgreSQL + Auth + Realtime + Edge Functions).

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
ng serve
# Opens http://localhost:4200
```

## Project Structure

```
src/
├── app/
│   ├── components/          # Shared UI components (menu, splash-screen, modals)
│   ├── guards/              # Route guards (authGuard, staffGuard, adminOnlyGuard)
│   ├── pages/               # All page components (lazy-loaded)
│   │   ├── auth/            # login, register
│   │   ├── shop/            # bread-catalog, dashboard
│   │   ├── cart/            # orders (cart + history), checkout
│   │   ├── info/            # about, company-history, about-products, contact-us, developers
│   │   ├── user/            # profile, notifications, promotions, feedback, custom-order
│   │   ├── payment/         # payment-success, payment-cancelled
│   │   └── admin/           # admin, order-oversight
│   ├── services/            # Business logic (Auth, Cart, Products, Orders, Vouchers, Payment, etc.)
│   ├── config/              # Supabase client config
│   └── theme/               # Global SCSS design system
├── environments/            # environment.ts / environment.prod.ts
└── index.html
supabase/
├── migrations/              # SQL migrations (0001–0010)
└── functions/               # Deno Edge Functions (create-payment, paymongo-webhook)
```

## Development

```bash
# Start dev server
ng serve

# Build for production
ng build

# Run unit tests
ng test --watch=false

# Lint
npm run lint
```

---

## Database Setup

Run migrations in Supabase SQL Editor (or `supabase db push`):

```
supabase/migrations/0001_roles_profiles.sql
supabase/migrations/0002_products_catalog.sql
supabase/migrations/0003_storage_bucket_policies.sql
supabase/migrations/0004_seed_demo_products.sql
supabase/migrations/0005_orders.sql
supabase/migrations/0006_vouchers.sql
supabase/migrations/0007_stock_more_tables.sql
supabase/migrations/0008_order_integrity.sql
supabase/migrations/0009_profiles_phone_avatar.sql
supabase/migrations/0010_payment_columns.sql
```

---

## Roles & First Admin

- **First signup on empty DB → Admin**
- **Subsequent signups → Customer**
- To manually assign admin:
  ```sql
  insert into public.user_roles (user_id, role)
  values ('<uuid>', 'admin')
  on conflict (user_id) do update set role = 'admin';
  ```

---

## Payment Setup (PayMongo)

### 1. Get PayMongo Keys

1. Create account at [PayMongo Dashboard](https://dashboard.paymongo.com)
2. Go to **Developers → API Keys**
3. Copy **Public Key** (`pk_test_...`) and **Secret Key** (`sk_test_...`)

### 2. Configure Supabase Secrets

```bash
# Secret key (NEVER in frontend code)
supabase secrets set PAYMONGO_SECRET_KEY=sk_test_xxxxx

# Webhook secret (from PayMongo webhook config)
supabase secrets set PAYMONGO_WEBHOOK_SECRET=whsk_xxxxx
```

### 3. Frontend Public Key

Edit `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  supabaseUrl: 'https://your-project.supabase.co',
  paymongoPublicKey: 'pk_test_xxxxx',  // ← Paste here
};
```

### 4. Deploy Edge Functions

```bash
supabase functions deploy create-payment
supabase functions deploy paymongo-webhook
```

### 5. Register Webhook in PayMongo Dashboard

1. Go to **Developers → Webhooks**
2. Click **Add Webhook**
3. **URL**: `https://<your-project-ref>.supabase.co/functions/v1/paymongo-webhook`
4. **Events**: Select `payment.paid`, `payment.failed`, `checkout_session.payment.paid`
5. **Secret**: Copy the `PAYMONGO_WEBHOOK_SECRET` you set above

### 6. Test with Test Cards

Use PayMongo test card numbers:
- **Success**: `4000 0000 0000 0002`
- **Decline**: `4000 0000 0000 0010`
- **3D Secure**: `4000 0000 0000 3220`
- Any future expiry, any CVC

---

## Supported Payment Methods

| Method | Code | Description |
|--------|------|-------------|
| Cash on Delivery | `cod` | Pay driver on delivery / at counter |
| Credit/Debit Card | `card` | Visa, Mastercard, JCB via PayMongo |
| GCash | `gcash` | GCash e-wallet |
| Maya | `paymaya` | Maya (formerly PayMaya) |
| GrabPay | `grab_pay` | GrabPay wallet |

All online methods redirect to PayMongo Checkout Session → return to `/payment-success` or `/payment-cancelled`.

---

## Environment Variables

| Variable | Location | Required? |
|----------|----------|-----------|
| `SUPABASE_URL` | `src/app/config/supabase.config.ts` | Yes |
| `SUPABASE_ANON_KEY` | `src/app/config/supabase.config.ts` | Yes |
| `PAYMONGO_SECRET_KEY` | Supabase Secret | Yes (online payments) |
| `PAYMONGO_WEBHOOK_SECRET` | Supabase Secret | Yes (online payments) |
| `PAYMONGO_PUBLIC_KEY` | `src/environments/environment.ts` | Yes (online payments) |
| `APP_URL` | Supabase Secret (optional) | For redirect URLs |
| `GOOGLE_MAPS_API_KEY` | Supabase Secret (optional) | For address autocomplete |

---

## Key Features

- **Product Catalog**: Real-time Supabase data, search, filter, sort, skeleton loading
- **Shopping Cart**: Per-user persistence, qty controls, vouchers, tax/delivery calc
- **Checkout**: Delivery/pickup, address autocomplete, scheduling, multi-payment
- **Orders**: Realtime status updates, customer + staff views, stock management
- **Vouchers**: Percent/fixed, category filters, min spend, claim/redeem flow
- **Admin**: Product CRUD, category mgmt, user roles, order status, sales charts
- **Notifications**: In-app inbox via DB triggers
- **Custom Orders**: Bespoke requests with staff notification

---

## Tech Stack

- **Frontend**: Angular 22 (standalone, zoneless), Ionic 9, RxJS, SCSS
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions)
- **Payments**: PayMongo (Checkout Sessions, Webhooks)
- **Maps**: Google Maps JS API (optional)
- **Icons**: Ionicons

---

## License

MIT