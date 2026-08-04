# VetDesk

VetDesk is a responsive veterinary clinic operations app built with React,
Vite, TypeScript, Tailwind CSS, Supabase, PayPal subscriptions, Resend email
reminders, and an installable PWA shell.

Project documentation:

- `VETDESK_AUDIT.md`
- `VETDESK_IMPLEMENTATION_PLAN.md`
- `VETDESK_IMPLEMENTATION_STATUS.md`
- `DATABASE_SETUP.md`
- `DEPLOYMENT_GUIDE.md`
- `TESTING_CHECKLIST.md`
- `CHANGELOG.md`

## Local setup

Requirements: Node.js 20 or newer and npm 10 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

Only public browser values belong in `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PAYPAL_CLIENT_ID`
- `VITE_PAYPAL_PLAN_ID`

Never place `SUPABASE_SERVICE_ROLE_KEY`, `PAYPAL_SECRET`, `RESEND_API_KEY`, or
`CRON_SECRET` in a `VITE_` variable. Vite embeds every `VITE_` value in the
browser bundle.

## Checks

```bash
npm run typecheck
npm run build
npm audit --omit=dev
```

`npm run check` runs both TypeScript and the production build.

## Supabase migration order

Apply migrations in filename order:

1. `20240727_add_email_notifications.sql`
2. `20240727_email_reminder_edge_functions.sql`
3. `20260803_production_hardening.sql`
4. `20260803_paypal_hardening.sql`
5. `20260803_storage_policies.sql`
6. `20260804_clinical_core.sql`

The hardening migration replaces existing policies on VetDesk application
tables with clinic-scoped RLS rules. Apply it in a staging project first and
test with two clinics before production.

The storage migration converts existing pet-photo public URLs to storage paths
and makes the `pet-photos` bucket private. Clinic logos remain public because
they are branding assets. The app creates one-hour signed URLs for private pet
and visit photos.

The clinical-core migration adds SOAP notes, vitals, patient alerts, medical
templates, vaccinations, prescriptions, laboratory orders, private clinical
documents, audit logging, and archive/recovery behavior. The original uploaded
repository did not include the migrations that created every base VetDesk
table; see `DATABASE_SETUP.md` before creating a new Supabase project.

## Edge Function secrets

Set these as Supabase Edge Function secrets, never as frontend variables:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` — a sender on a verified Resend domain for production
- `CRON_SECRET` — a long random value used only by the reminder scheduler
- `PAYPAL_CLIENT_ID`
- `PAYPAL_SECRET`
- `PAYPAL_PLAN_ID`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_BASE_URL` — `https://api-m.sandbox.paypal.com` in sandbox or
  `https://api-m.paypal.com` in production
- `APP_ORIGINS` — comma-separated allowed web origins, for example
  `https://vetdesk-gules.vercel.app,http://localhost:22681`

Supabase automatically provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` to deployed functions.

Deploy the functions after applying migrations:

```bash
supabase functions deploy send-test-email
supabase functions deploy process-reminders --no-verify-jwt
supabase functions deploy paypal-register-subscription
supabase functions deploy paypal-webhook --no-verify-jwt
```

`supabase/config.toml` records the same JWT verification choices.

## Reminder schedule

Database triggers create, cancel, and reschedule notification queue entries when
appointments, recalls, or notification settings change. Do not schedule email
jobs from the browser.

Call `process-reminders` every five minutes using a trusted scheduler. Send the
secret as either:

```text
Authorization: Bearer <CRON_SECRET>
```

or:

```text
x-cron-secret: <CRON_SECRET>
```

The processor claims each job before sending, retries failures with backoff,
recovers stale jobs, and prevents already-recorded notifications from being
sent twice.

## PayPal

The registration function authenticates the VetDesk administrator, verifies
the subscription directly with PayPal, confirms the expected plan, and prevents
one PayPal subscription from being assigned to two clinics.

Configure the PayPal webhook URL to the deployed `paypal-webhook` function and
subscribe to billing subscription lifecycle and payment failure events. Store
the PayPal webhook ID in `PAYPAL_WEBHOOK_ID`; webhook requests are rejected
unless PayPal verifies their signature.

`create-paypal-live-plan.mjs` is a one-time helper. It reads credentials from
server environment variables so the secret is not typed into an unmasked
terminal prompt.

## Required acceptance checks

Before production release, use test accounts and verify:

1. signup with and without email confirmation;
2. clinic provisioning and subscription activation;
3. owner → pet → appointment → visit → recall persistence after refresh;
4. admin, veterinarian, and receptionist permissions;
5. Clinic A cannot select or mutate Clinic B data;
6. appointment cancellation and recall completion cancel queued reminders;
7. private pet photos render through signed URLs;
8. PayPal sandbox activation, cancellation, suspension, and duplicate webhook;
9. 360 px, tablet, and desktop layouts;
10. install, update, and offline PWA shell behavior.

Do not test PayPal using real charges. Apply database changes and Edge Functions
in staging before production.
