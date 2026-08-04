# VetDesk implementation status

Legend: **Completed**, **In progress**, **Not started**, **Blocked**, **Requires external credentials**.

| Area | Status | Evidence / remaining scope |
|---|---|---|
| Authentication and clinic provisioning | Completed | Supabase Auth, secure provisioning RPC, confirmation-aware signup |
| Tenant isolation and core RLS | Completed | `20260803_production_hardening.sql`; requires staging execution test |
| Staff roles | In progress | Admin/veterinarian/receptionist enforced; custom roles and permission matrix not started |
| Owner and pet records | Completed | CRUD plus admin-only archive, recovery RPCs, tenant-scoped indexes |
| Medical profile | Completed | Alerts, allergies, chronic conditions, microchip, insurance, reproductive/deceased state |
| SOAP clinical notes and vitals | Completed | UI, API, migration, RLS, templates, draft/final/amended states |
| Weight history/chart | In progress | Visit weights exist; visual longitudinal chart not added |
| Vaccinations | In progress | Structured records and automatic recalls complete; printable certificate not added |
| Prescriptions | In progress | Creation/status/refills/warnings complete; labels and inventory deduction await inventory |
| Laboratory | In progress | Order/status/result/review/abnormal/document support complete; external lab integration not added |
| Diagnostic imaging | In progress | Secure document type exists; structured modality/report workflow not added |
| Clinical documents | Completed | Private 10 MB PDF/image storage, metadata, signed URLs, owner-visibility marker |
| Procedures and surgery | Not started | Requires dedicated treatment/procedure/anaesthesia model |
| Hospitalization | Not started | Requires admissions, beds, MAR, observations, schedules, discharge workflow |
| Appointments/calendar | In progress | List/create/status/reminders complete; week/month/drag/drop/conflict/availability not added |
| Owner portal | Not started | Must use separate auth mapping and owner-safe views that exclude internal fields |
| Clinic invoices/payments | Not started | Keep separate from VetDesk SaaS subscription |
| Inventory | Not started | Required before automatic medication deduction |
| Communication history | In progress | Email queue/history complete; central timeline/SMS/WhatsApp abstractions not added |
| Tasks/collaboration | Not started | — |
| Multi-clinic branches | Not started | Current isolation is one clinic per staff user; organization/branch model not added |
| Reports/analytics | In progress | Dashboard/export exists; finance/inventory/retention analytics await source modules |
| Search/navigation | In progress | Owner/pet search exists; global indexed multi-entity search not added |
| In-app notifications | Not started | — |
| Settings | In progress | Clinic/reminder/email/timezone settings exist; finance/templates/retention settings not added |
| Localization | Not started | Existing strings are not centralized |
| PWA | In progress | Installable shell/update/precache complete; offline clinical writes intentionally disabled |
| Security/privacy | In progress | RLS, secrets, file checks, audit, archive complete; consent/retention/login history remain |
| Audit log | In progress | Important row mutations captured; auth failures, reads, exports, and IP context remain |
| Import/export/backup | In progress | Safe CSV/XLSX export complete; validated imports and documented restore drill not added |
| PayPal SaaS subscription | In progress | Verified registration/webhooks/status complete; plans/trial/grace/annual/limits/admin UI remain |
| SaaS super-admin | Not started | Must be isolated from clinic administration |
| Responsive UI and accessibility | In progress | Responsive shell/cards/forms exist; full keyboard/screen-reader audit remains |
| Automated tests | Not started | Manual checklist prepared; Vitest/Playwright/pgTAP need implementation |
| Resend production email | Requires external credentials | Requires verified domain, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` |
| PayPal production billing | Requires external credentials | Requires live PayPal credentials, plan, and webhook ID |
| Fresh database reproduction | Blocked | Original base-schema migration/dump was not included in the uploaded source |

Last automated result in this package: TypeScript check and production build pass; npm production audit reports zero known vulnerabilities; all four Edge Function entry points bundle successfully.
