# VetDesk database setup

## Important prerequisite

The uploaded repository did not include the migrations that originally created every base VetDesk table. For the existing linked Supabase project, apply the incremental migrations below. For a brand-new Supabase project, first export a schema-only baseline from the current project, review it for secrets/data, commit it as the first migration, and only then run these incremental migrations.

Never disable RLS and never place the service-role key in a browser environment variable.

## Migration order

1. `supabase/migrations/20240727_add_email_notifications.sql`
2. `supabase/migrations/20240727_email_reminder_edge_functions.sql`
3. `supabase/migrations/20260803_production_hardening.sql`
4. `supabase/migrations/20260803_paypal_hardening.sql`
5. `supabase/migrations/20260803_storage_policies.sql`
6. `supabase/migrations/20260804_clinical_core.sql`

Use Supabase CLI migration deployment against staging first:

```bash
supabase link --project-ref YOUR_STAGING_PROJECT_REF
supabase db push --dry-run
supabase db push
```

Review the dry run and create a database backup before production deployment.

## What the clinical migration does

- Backfills `clinic_id` on pets and visits from existing relationships.
- Adds clinical profile and SOAP/vital fields without removing old columns.
- Creates templates, vaccinations, prescriptions, lab orders, clinical documents, and audit log.
- Replaces owner/pet/visit policies with archive-aware and clinical-role policies.
- Prevents physical deletion of retained clinical/business records.
- Adds admin-only archive/recovery RPCs.
- Adds a private `medical-documents` bucket and storage-object policies.
- Adds vaccination-to-recall synchronization and clinical audit triggers.

## Staging validation queries

Run these as database owner only; do not expose results containing patient data:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

Then use two real staging login sessions. Clinic A must receive zero rows and no successful mutations for every known Clinic B identifier.

## Backup and restore

- Enable Supabase point-in-time recovery where the chosen plan supports it.
- Before migrations, create a verified logical backup according to Supabase documentation for the deployed plan.
- Practice restore into a separate project, not directly over production.
- Archived owner/pet records can be restored by an authenticated clinic administrator through `restore_archived_owner(bigint)` or `restore_archived_pet(bigint)`. A dedicated archive UI is a future module.
