# VetDesk deployment guide

## 1. Frontend configuration

Copy `.env.example` to `.env` locally and set only public browser values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PAYPAL_CLIENT_ID`
- `VITE_PAYPAL_PLAN_ID`

Run:

```bash
npm ci
npm run check
```

Deploy `dist/public` through Vercel after the staging acceptance gate passes. Configure SPA rewrites to `/index.html`.

## 2. Database

Follow `DATABASE_SETUP.md`. Apply migrations to staging, execute two-clinic isolation checks, and create a production backup before `supabase db push` against production.

## 3. Edge Function secrets

Set server-only secrets:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CRON_SECRET`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_SECRET`
- `PAYPAL_PLAN_ID`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_BASE_URL`
- `APP_ORIGINS`

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions. Never copy these server secrets to a `VITE_` variable.

Deploy:

```bash
supabase functions deploy send-test-email
supabase functions deploy process-reminders --no-verify-jwt
supabase functions deploy paypal-register-subscription
supabase functions deploy paypal-webhook --no-verify-jwt
```

## 4. External services

- Verify the Resend sending domain and use its approved sender in `RESEND_FROM_EMAIL`.
- Configure the PayPal webhook URL and subscribe to billing-subscription lifecycle and payment-failure events.
- Use sandbox credentials until every billing scenario passes.
- Schedule `process-reminders` every five minutes. Send `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`.

## 5. Release gate

Do not publish until:

- `npm ci`, typecheck, build, and audit pass from a clean checkout.
- Migrations apply successfully to a production-like clone.
- RLS tests with two clinics pass.
- Signup, staff roles, patient clinical flow, private files, reminders, and PayPal sandbox pass.
- Mobile 360 px, tablet, desktop, PWA install/update, and offline-shell checks pass.
- Monitoring, backup, restore owner, and rollback owners are assigned.

## Rollback

Frontend rollback is a previous Vercel deployment. Database rollback must be planned per migration and restored from a verified backup when reversal would lose or reinterpret data. Do not write destructive `DOWN` migrations for medical records.
