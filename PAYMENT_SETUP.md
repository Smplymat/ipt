# PayMongo Payment Setup Guide

This guide walks you through setting up PayMongo payments for the Knead to Know bakery app.

## Prerequisites

1. A [PayMongo account](https://dashboard.paymongo.com)
2. Supabase CLI installed (`npm install -g supabase`)
3. Supabase project linked (`supabase link --project-ref <your-project-ref>`)

## 1. Get PayMongo API Keys

### Test Mode (Development)
1. Go to [PayMongo Dashboard → Settings → API Keys](https://dashboard.paymongo.com/settings/api-keys)
2. Make sure you're in **Test Mode** (toggle in top-right)
3. Copy the **Secret Key** (starts with `sk_test_`)
4. Copy the **Public Key** (starts with `pk_test_`)

### Webhook Secret
1. Go to [PayMongo Dashboard → Developers → Webhooks](https://dashboard.paymongo.com/settings/webhooks)
2. Click **Add Webhook**
3. URL: `https://<your-project-ref>.supabase.co/functions/v1/paymongo-webhook`
4. Events to subscribe:
   - `checkout_session.payment.paid` (the one that marks orders as paid)
   - any `...failed` / `...expired` checkout events your dashboard offers (optional)
5. Create the webhook in **Test Mode** while using test keys (webhooks are per mode).
6. Copy the **Signing Secret** (starts with `whsk_`)

## 2. Set Supabase Secrets

```bash
# Login to Supabase (if not already logged in)
supabase login

# Link to your project (if not already linked)
supabase link --project-ref vbrbtajunsewqysqpfck

# Set PayMongo secrets (use TEST keys for development!)
supabase secrets set PAYMONGO_SECRET_KEY=sk_test_YOUR_TEST_SECRET_KEY
supabase secrets set PAYMONGO_WEBHOOK_SECRET=whsk_YOUR_TEST_WEBHOOK_SECRET

# Where PayMongo sends customers after paying (your deployed site, no trailing slash)
supabase secrets set APP_URL=https://your-site.netlify.app

# Verify secrets are set
supabase secrets list
```

## 3. Deploy Edge Functions

```bash
# Deploy the create-payment function
supabase functions deploy create-payment

# Deploy the paymongo-webhook function
supabase functions deploy paymongo-webhook --no-verify-jwt
# (supabase/config.toml also sets verify_jwt = false for this function.
#  PayMongo does not send a Supabase JWT, so without this the webhook gets 401.)

# Mobile app only: bounces the customer back into the installed app after paying
supabase functions deploy payment-return --no-verify-jwt

# Verify deployments
supabase functions list
```

## 4. Local Development (Optional)

For local testing without deploying:

```bash
# Start local Supabase stack
supabase start

# Serve edge functions locally with env file
supabase functions serve create-payment --env-file ./supabase/.env.local
supabase functions serve paymongo-webhook --env-file ./supabase/.env.local
```

Then update `src/environments/environment.ts` to point to local functions:
```typescript
export const environment = {
  production: false,
  supabaseUrl: 'http://127.0.0.1:54321', // Local Supabase URL
  paymongoPublicKey: 'pk_test_YOUR_TEST_PUBLIC_KEY',
};
```

## 5. Test the Integration

### Test Card (Test Mode Only)
Use these test card numbers:
- **Success**: `4242 4242 4242 4242` (any future expiry, any CVC)
- **Decline**: `4000 0000 0000 0002`
- **3D Secure Required**: `4000 0000 0000 3220`

### Test Flow
1. Add items to cart
2. Go to checkout
3. Select "Credit/Debit Card" (or GCash, Maya, GrabPay)
4. Click "Place Delivery Order"
5. Should redirect to PayMongo checkout page
6. Complete payment with test card
7. Should redirect back to `/payment-success?order_id=...`
8. Order should show as `payment_status: paid` in Supabase

## 6. Production Deployment

When ready for production:
1. Switch PayMongo to **Live Mode**
2. Get new **Live Secret Key** (`sk_live_...`) and **Live Public Key** (`pk_live_...`)
3. Create new webhook for production URL
4. Update Supabase secrets:
   ```bash
   supabase secrets set PAYMONGO_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY
   supabase secrets set PAYMONGO_WEBHOOK_SECRET=whsk_YOUR_LIVE_WEBHOOK_SECRET
   ```
5. Update `src/environments/environment.prod.ts`:
   ```typescript
   export const environment = {
     production: true,
     supabaseUrl: 'https://vbrbtajunsewqysqpfck.supabase.co',
     paymongoPublicKey: 'pk_live_YOUR_LIVE_PUBLIC_KEY',
   };
   ```
6. Re-deploy functions:
   ```bash
   supabase functions deploy create-payment
   supabase functions deploy paymongo-webhook
   ```

## Troubleshooting

### "Failed to fetch" / CORS Error
- Ensure edge functions are deployed: `supabase functions list`
- Check function logs: `supabase functions logs create-payment`
- Verify CORS headers are present in function responses

### "Payment gateway not configured"
- `PAYMONGO_SECRET_KEY` secret not set in Supabase
- Run `supabase secrets list` to verify

### Webhook Not Firing
- Verify webhook URL in PayMongo dashboard matches your Supabase project
- Check webhook logs in PayMongo dashboard
- Check Supabase function logs: `supabase functions logs paymongo-webhook`

### "Invalid signature" on Webhook
- Ensure `PAYMONGO_WEBHOOK_SECRET` matches the webhook signing secret in PayMongo
- Don't modify the request body before signature verification

## Security Notes

- **NEVER** put secret keys (`sk_...`, `whsk_...`) in frontend code or environment files
- Only the **public key** (`pk_...`) goes in `src/environments/environment.ts`
- Secret keys must only live in Supabase secrets (server-side)
- Use test keys (`sk_test_...`) for development
- Rotate keys immediately if accidentally committed