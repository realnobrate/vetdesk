-- Add notification settings to clinics table
ALTER TABLE clinics 
ADD COLUMN IF NOT EXISTS appointment_reminders_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS recall_reminders_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS appointment_reminder_hours_before INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS recall_reminder_days_before INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS email_sender_name VARCHAR(255) DEFAULT 'VetDesk',
ADD COLUMN IF NOT EXISTS reply_to_email VARCHAR(255);

-- Create notification queue table
CREATE TABLE IF NOT EXISTS notification_queue (
  id BIGSERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'appointment_reminder', 'vaccine_reminder'
  target_id INTEGER NOT NULL, -- appointment_id or recall_id
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'cancelled'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_queue_clinic_status ON notification_queue(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_for ON notification_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_queue_type_target ON notification_queue(type, target_id);

-- Create sent emails tracking table
CREATE TABLE IF NOT EXISTS sent_emails (
  id BIGSERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  notification_queue_id BIGINT REFERENCES notification_queue(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for email statistics
CREATE INDEX IF NOT EXISTS idx_sent_emails_clinic_sent_at ON sent_emails(clinic_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_sent_emails_status ON sent_emails(status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for notification_queue
DROP TRIGGER IF EXISTS update_notification_queue_updated_at ON notification_queue;
CREATE TRIGGER update_notification_queue_updated_at
  BEFORE UPDATE ON notification_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_emails ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_queue
CREATE POLICY "Clinics can view their own notification queue"
  ON notification_queue FOR SELECT
  USING (clinic_id IN (SELECT id FROM clinics WHERE id = clinic_id));

CREATE POLICY "Clinics can insert their own notification queue"
  ON notification_queue FOR INSERT
  WITH CHECK (clinic_id IN (SELECT id FROM clinics WHERE id = clinic_id));

CREATE POLICY "Clinics can update their own notification queue"
  ON notification_queue FOR UPDATE
  USING (clinic_id IN (SELECT id FROM clinics WHERE id = clinic_id));

-- RLS policies for sent_emails
CREATE POLICY "Clinics can view their own sent emails"
  ON sent_emails FOR SELECT
  USING (clinic_id IN (SELECT id FROM clinics WHERE id = clinic_id));

CREATE POLICY "Clinics can insert their own sent emails"
  ON sent_emails FOR INSERT
  WITH CHECK (clinic_id IN (SELECT id FROM clinics WHERE id = clinic_id));

CREATE POLICY "Clinics can update their own sent emails"
  ON sent_emails FOR UPDATE
  USING (clinic_id IN (SELECT id FROM clinics WHERE id = clinic_id));
