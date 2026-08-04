# VetDesk technical and product audit

Audit date: 2026-08-03  
Audited artifact: uploaded React/Vite/Supabase source project plus the hardening and clinical-core changes in this package.

## Production-readiness assessment

VetDesk is a strong **staging candidate**, but it is not yet responsible to call it a complete production veterinary practice-management system. The core owner/pet/appointment/visit/recall workflows build successfully, tenant hardening is included, and the new clinical core has a complete code path from UI to RLS-protected tables. Production release still requires applying migrations to a staging Supabase project, testing with two isolated clinics, deploying Edge Functions, verifying PayPal/Resend with sandbox accounts, and running the manual regression checklist.

The supplied repository does not contain the original migrations that created every base table (`clinics`, `staff`, `owners`, `pets`, `visits`, `recalls`, `appointments`, and `visit_photos`). It contains incremental notification migrations and the new hardening migrations. A schema-only baseline dump from the existing Supabase project is therefore still required before a brand-new environment can be reproduced from zero.

## Existing architecture

- Vite 7, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Lucide icons.
- Wouter routing with lazy-loaded screens.
- TanStack Query for remote state.
- Supabase Auth, PostgreSQL, RLS, Storage, RPCs, and Edge Functions.
- PayPal subscription approval and verified webhooks.
- Resend email delivery through Edge Functions.
- PWA manifest, generated service worker, update registration, and app-shell cache.
- PDF generation with jsPDF and CSV/XLSX-compatible export without the vulnerable `xlsx` package.

## Working product areas

- Signup/signin/signout and clinic provisioning.
- Active staff and active-subscription route enforcement.
- Owners, pets, visits, recalls, appointments, staff, clinic settings, dashboard, search, and export.
- Responsive desktop/mobile shell and installable PWA assets.
- Appointment and recall email queue with claiming, retry, stale-job recovery, and provider idempotency.
- PayPal subscription registration with server-side plan verification and signed, idempotent webhook processing.
- Structured clinical profile, SOAP notes, vitals, note templates, vaccinations, prescriptions, lab orders/results, clinical documents, and clinical-summary PDF.

## Important issues found and addressed

1. Earlier notification RLS policies compared ambiguous `clinic_id` values and were effectively permissive. They are replaced by active-staff clinic policies.
2. The reminder processor was externally callable without a scheduler secret. It now requires `CRON_SECRET` and uses the service role only inside the Edge Function.
3. A browser-facing email key variable could expose a Resend credential. No email provider secret remains in frontend configuration.
4. Staff role names were inconsistent. Roles now use `admin`, `veterinarian`, and `receptionist` consistently.
5. Admin screens had no route-level role enforcement. Billing, staff, and settings now require an active admin.
6. Pet photos used public URLs. The patient-photo bucket is private and URLs are signed for one hour.
7. PayPal registration trusted insufficient client state. The server now fetches the subscription from PayPal and verifies its plan and ownership.
8. Webhook verification/idempotency were incomplete. PayPal signature verification and an event ledger are included.
9. Reminder scheduling was duplicated in browser code. Database triggers now schedule/cancel/reschedule jobs.
10. The original dependency set contained known high/critical advisories. The final production dependency audit reports zero known vulnerabilities.
11. Hard deletion could remove business or medical history. Owners/pets now archive through admin-only RPCs; clinical records reject physical deletion and mutations are audited.
12. The original visit model was too shallow. SOAP fields, vitals, final/amended status, reusable templates, and structured clinical modules are included.

## Open technical/product risks

- No automated unit, component, browser E2E, or database RLS test suite exists yet.
- The new SQL must be exercised against a cloned/staging database; this package cannot safely apply it to production on the user's behalf.
- The original base schema migrations are missing from the repository.
- Offline mode caches only the app shell. Sensitive clinical datasets are intentionally not persisted offline and queued clinical mutations are not enabled.
- Owner portal, invoicing, inventory, procedures, hospitalization, tasks, notification center, branch management, and SaaS super-admin remain separate future modules.
- Localization is not yet centralized; existing UI strings are mostly English.
- Audit logging covers important row mutations, but login history, failed authorization attempts, document-read events, and export events need server-side event capture.
- Recovery RPCs exist for archived owners/pets, but a dedicated archive-management UI is not included yet.

## Security model

- Active staff membership resolves the current clinic; tenant IDs are derived instead of trusted from forms.
- Sensitive clinical writes require `admin` or `veterinarian` in both UI and RLS/trigger enforcement.
- Normal staff may read clinical records for their clinic; future owner-portal access must use separate policies/views that exclude internal notes.
- Medical and pet files are private, MIME/size constrained, and served by short-lived signed URLs.
- Service-role, PayPal, Resend, and cron secrets exist only in Edge Function configuration.
- Audit-log rows cannot be inserted, modified, or deleted by normal authenticated users.

## Recommended next engineering phase

Create the financial/inventory foundation together rather than separately: service catalogue, decimal-safe estimates/invoices/payments, products/batches/stock movements, and transaction-based inventory deduction. Add pgTAP tenant-isolation tests and Playwright critical-flow tests before that phase is released.
