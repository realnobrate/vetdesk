# Changelog

## 0.2.0 — 2026-08-03

### Added

- Production hardening, storage, PayPal, and clinical-core migrations.
- Active-staff tenant helper functions and secure clinic provisioning/staff RPCs.
- Private patient photos and private clinical-document bucket policies.
- SOAP notes, vitals, clinical warnings/profile, reusable note templates, and amended-record tracking.
- Vaccinations with automatic recall synchronization.
- Prescriptions with status, instructions, warnings, and refill counters.
- Laboratory ordering, workflow, results, abnormal flag, review, and owner-notification state.
- Clinical documents with signed one-hour access and 10 MB MIME/size limits.
- Clinical summary PDF and responsive six-tab patient record.
- Immutable-to-clinic-users audit log and medical-record hard-delete prevention.
- Admin-only owner/pet archive and recovery RPCs.
- Documentation suite for audit, plan, status, database, deployment, and testing.

### Changed

- Standalone npm dependency versions and TypeScript configuration.
- Lazy-loaded routes and explicit vendor chunks.
- Role names standardized to admin/veterinarian/receptionist.
- Staff/settings/billing protected at route and data layers.
- Reminder scheduling moved from the browser to database triggers.
- Reminder processor now claims work, retries with backoff, recovers stale jobs, and uses Resend idempotency keys.
- PayPal registration verifies subscription state/plan server-side; webhook verifies PayPal signatures.
- Owner/pet deletion UI now archives records and is visible only to administrators.
- XLSX export implementation replaced the vulnerable `xlsx` package.

### Removed

- Browser email-provider secret usage.
- Replit-specific build plugins/configuration.
- Client-side reminder scheduler and direct email queue write helpers.

### Security

- Replaced permissive notification policies and all core VetDesk RLS policies.
- Added private storage path authorization and MIME/size restrictions.
- Added plan/tenant checks, scheduler secret, CORS allowlist, rate limiting, and webhook event ledger.
- Production dependency audit reduced to zero known vulnerabilities at packaging time.
