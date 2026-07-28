-- Incremental migration for email reminder Edge Functions
-- This migration assumes:
-- - clinics table has notification columns (appointment_reminders_enabled, recall_reminders_enabled, etc.)
-- - notification_queue table exists with proper structure
-- - sent_emails table exists with proper structure
-- - RLS policies are already in place for tenant isolation
-- - clinics.id and staff.clinic_id are BIGINT

-- No schema changes required - all tables and columns already exist
-- Edge Functions will be deployed separately using supabase functions deploy
