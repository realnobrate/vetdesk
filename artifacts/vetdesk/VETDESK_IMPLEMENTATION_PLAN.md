# VetDesk implementation plan

## Phase 1 — stability and security

Status: **Completed in code; staging verification required**.

- Reproducible npm/Vite/TypeScript build.
- Dependency remediation.
- Strict tenant RLS and active staff checks.
- Role-protected routes and staff operations.
- Secure private patient files.
- Server-only email and PayPal secrets.
- Reliable reminder queue and PayPal webhook ledger.
- Signup/subscription/error-state fixes.
- Lazy loading and vendor chunking.

Exit gate: apply migrations to staging, test Clinic A versus Clinic B, deploy Edge Functions, and complete PayPal/Resend sandbox checks.

## Phase 2 — clinical core

Status: **Implemented in this package; staging verification required**.

- Longitudinal patient clinical profile and warnings.
- SOAP notes, vitals, draft/final/amended state, and reusable note templates.
- Structured vaccination records with automatic recall synchronization.
- Structured prescriptions and medication lifecycle.
- Laboratory ordering, workflow, results, abnormal flag, and review state.
- Private clinical documents and signed access.
- Clinical-summary PDF.
- Mutation audit log and protected medical history.
- Owner/pet soft deletion and admin recovery RPCs.

Next additions inside this phase: printable vaccination certificates and prescription labels, structured imaging metadata, weight chart, referral documents, and clinical attachment linking UI for individual visits/lab orders.

## Phase 3 — operations and finance

Status: **Not started**.

Implement in this order:

1. Service and product catalogue.
2. Decimal-safe estimates, approvals, invoices, taxes, discounts, payments, receipts, and refunds.
3. Inventory products, suppliers, batches, expiry dates, stock movements, purchase orders, and low-stock alerts.
4. Transactional linkage between dispensed medication/invoice items and stock movements.
5. Tasks, handover notes, internal notifications, and communication history/provider abstractions.
6. Reports for revenue, debt, stock, appointments, recalls, and clinical throughput.

## Phase 4 — scale and commercialization

Status: **Not started**.

- Organizations, branches, branch memberships, branch switcher, and plan limits.
- Granular/custom permission matrix beyond the three current roles.
- Owner portal with deliberately restricted database views/policies.
- Advanced calendar, working hours, availability, conflict checks, waiting room, and public confirmation tokens.
- Procedures, surgery, hospitalization, treatment plans, and consent signatures.
- Notification center and push-ready subscriptions.
- Serbian Latin/Cyrillic/English localization architecture.
- SaaS plans, trials, grace periods, annual billing, limits, and isolated super-admin plane.
- Data import preview/error reports, archive UI, backups, and restore drills.

## Quality gates for every future module

- Migration, constraints, indexes, RLS, and two-tenant tests.
- UI, validation, loading/empty/error/success states, mobile layout, and accessibility.
- Audit events and soft deletion where records must be retained.
- Unit tests for calculations and Playwright tests for the critical flow.
- Updated status, changelog, setup, and testing documents.
- No feature is marked completed until all of the above exist.
