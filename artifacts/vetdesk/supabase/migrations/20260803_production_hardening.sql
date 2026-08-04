-- VetDesk production hardening
-- Apply this migration before deploying the matching frontend and Edge Functions.

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Belgrade';

ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;
UPDATE public.staff SET role = 'veterinarian' WHERE role = 'vet';
UPDATE public.staff SET role = 'receptionist' WHERE role = 'front_desk';
ALTER TABLE public.staff
  ADD CONSTRAINT staff_role_check
  CHECK (role IN ('admin', 'veterinarian', 'receptionist'));

ALTER TABLE public.notification_queue
  DROP CONSTRAINT IF EXISTS notification_queue_status_check;
ALTER TABLE public.notification_queue
  ADD CONSTRAINT notification_queue_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled'));

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY type, target_id, scheduled_for
      ORDER BY id
    ) AS position
  FROM public.notification_queue
  WHERE status IN ('pending', 'processing')
)
UPDATE public.notification_queue AS queue
SET
  status = 'cancelled',
  error_message = 'Duplicate queue entry removed during hardening'
FROM ranked
WHERE queue.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS notification_queue_active_unique
  ON public.notification_queue(type, target_id, scheduled_for)
  WHERE status IN ('pending', 'processing');

WITH ranked_sent AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY notification_queue_id
      ORDER BY sent_at, id
    ) AS position
  FROM public.sent_emails
  WHERE notification_queue_id IS NOT NULL AND status = 'sent'
)
UPDATE public.sent_emails AS email
SET
  status = 'duplicate',
  error_message = 'Duplicate delivery record removed during hardening'
FROM ranked_sent
WHERE email.id = ranked_sent.id AND ranked_sent.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS sent_emails_notification_sent_unique
  ON public.sent_emails(notification_queue_id)
  WHERE notification_queue_id IS NOT NULL AND status = 'sent';

CREATE INDEX IF NOT EXISTS staff_user_id_idx ON public.staff(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS staff_user_id_unique
  ON public.staff(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS staff_clinic_status_idx ON public.staff(clinic_id, status);
CREATE INDEX IF NOT EXISTS owners_clinic_idx ON public.owners(clinic_id);
CREATE INDEX IF NOT EXISTS pets_owner_idx ON public.pets(owner_id);
CREATE INDEX IF NOT EXISTS visits_pet_date_idx ON public.visits(pet_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS recalls_clinic_status_due_idx
  ON public.recalls(clinic_id, status, due_date);
CREATE INDEX IF NOT EXISTS appointments_clinic_scheduled_idx
  ON public.appointments(clinic_id, scheduled_at);

CREATE OR REPLACE FUNCTION public.current_staff_clinic_id()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id::bigint
  FROM public.staff
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.staff
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_current_clinic_admin(target_clinic_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff
    WHERE user_id = auth.uid()
      AND clinic_id = target_clinic_id
      AND role = 'admin'
      AND status = 'active'
  )
$$;

REVOKE ALL ON FUNCTION public.current_staff_clinic_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_staff_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_current_clinic_admin(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_staff_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_staff_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_clinic_admin(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.provision_vetdesk_clinic()
RETURNS SETOF public.staff
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_email text := lower(COALESCE(auth.jwt()->>'email', ''));
  display_name text := trim(COALESCE(auth.jwt()->'user_metadata'->>'name', ''));
  new_clinic_id bigint;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT * FROM public.staff WHERE user_id = current_user_id LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  IF current_email <> '' THEN
    UPDATE public.staff
    SET user_id = current_user_id
    WHERE id = (
      SELECT id
      FROM public.staff
      WHERE user_id IS NULL AND lower(email) = current_email
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    );

    IF FOUND THEN
      RETURN QUERY
      SELECT * FROM public.staff WHERE user_id = current_user_id LIMIT 1;
      RETURN;
    END IF;
  END IF;

  IF display_name = '' THEN display_name := 'Clinic Administrator'; END IF;

  INSERT INTO public.clinics (name)
  VALUES (display_name || '''s Clinic')
  RETURNING id INTO new_clinic_id;

  RETURN QUERY
  INSERT INTO public.staff (
    user_id, clinic_id, name, email, role, status
  )
  VALUES (
    current_user_id,
    new_clinic_id,
    display_name,
    current_email,
    'admin',
    'active'
  )
  RETURNING *;
END
$$;

REVOKE ALL ON FUNCTION public.provision_vetdesk_clinic() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_vetdesk_clinic() TO authenticated;

DO $$
DECLARE
  table_name text;
  existing_policy record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'clinics', 'staff', 'owners', 'pets', 'visits', 'visit_photos',
    'recalls', 'appointments', 'notification_queue',
    'sent_emails'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

      FOR existing_policy IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = table_name
      LOOP
        EXECUTE format(
          'DROP POLICY IF EXISTS %I ON public.%I',
          existing_policy.policyname,
          table_name
        );
      END LOOP;
    END IF;
  END LOOP;
END
$$;

CREATE POLICY clinics_read_own ON public.clinics
  FOR SELECT TO authenticated
  USING (id = public.current_staff_clinic_id());
CREATE POLICY clinics_admin_update ON public.clinics
  FOR UPDATE TO authenticated
  USING (public.is_current_clinic_admin(id))
  WITH CHECK (public.is_current_clinic_admin(id));

CREATE POLICY staff_read_own_clinic ON public.staff
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR clinic_id = public.current_staff_clinic_id()
  );
CREATE POLICY staff_admin_update ON public.staff
  FOR UPDATE TO authenticated
  USING (public.is_current_clinic_admin(clinic_id))
  WITH CHECK (public.is_current_clinic_admin(clinic_id));
CREATE POLICY staff_admin_delete ON public.staff
  FOR DELETE TO authenticated
  USING (public.is_current_clinic_admin(clinic_id) AND user_id IS DISTINCT FROM auth.uid());

CREATE POLICY owners_own_clinic ON public.owners
  FOR ALL TO authenticated
  USING (clinic_id = public.current_staff_clinic_id())
  WITH CHECK (clinic_id = public.current_staff_clinic_id());

CREATE POLICY pets_own_clinic ON public.pets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.owners
      WHERE owners.id = pets.owner_id
        AND owners.clinic_id = public.current_staff_clinic_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.owners
      WHERE owners.id = pets.owner_id
        AND owners.clinic_id = public.current_staff_clinic_id()
    )
  );

CREATE POLICY visits_own_clinic ON public.visits
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pets
      JOIN public.owners ON owners.id = pets.owner_id
      WHERE pets.id = visits.pet_id
        AND owners.clinic_id = public.current_staff_clinic_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pets
      JOIN public.owners ON owners.id = pets.owner_id
      WHERE pets.id = visits.pet_id
        AND owners.clinic_id = public.current_staff_clinic_id()
    )
  );

CREATE POLICY visit_photos_own_clinic ON public.visit_photos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.visits
      JOIN public.pets ON pets.id = visits.pet_id
      JOIN public.owners ON owners.id = pets.owner_id
      WHERE visits.id = visit_photos.visit_id
        AND owners.clinic_id = public.current_staff_clinic_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.visits
      JOIN public.pets ON pets.id = visits.pet_id
      JOIN public.owners ON owners.id = pets.owner_id
      WHERE visits.id = visit_photos.visit_id
        AND owners.clinic_id = public.current_staff_clinic_id()
    )
  );

CREATE POLICY recalls_own_clinic ON public.recalls
  FOR ALL TO authenticated
  USING (clinic_id = public.current_staff_clinic_id())
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND EXISTS (
      SELECT 1
      FROM public.pets
      JOIN public.owners ON owners.id = pets.owner_id
      WHERE pets.id = recalls.pet_id
        AND owners.clinic_id = public.current_staff_clinic_id()
    )
  );

CREATE POLICY appointments_own_clinic ON public.appointments
  FOR ALL TO authenticated
  USING (clinic_id = public.current_staff_clinic_id())
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND EXISTS (
      SELECT 1
      FROM public.pets
      JOIN public.owners ON owners.id = pets.owner_id
      WHERE pets.id = appointments.pet_id
        AND owners.clinic_id = public.current_staff_clinic_id()
    )
  );

CREATE POLICY notification_queue_read_own ON public.notification_queue
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_staff_clinic_id());

CREATE POLICY sent_emails_read_own ON public.sent_emails
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_staff_clinic_id());

CREATE OR REPLACE FUNCTION public.admin_add_pending_staff(
  staff_name text,
  staff_email text,
  staff_role text
)
RETURNS SETOF public.staff
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_clinic_id bigint;
BEGIN
  caller_clinic_id := public.current_staff_clinic_id();

  IF caller_clinic_id IS NULL
    OR NOT public.is_current_clinic_admin(caller_clinic_id) THEN
    RAISE EXCEPTION 'Only clinic administrators can add staff members';
  END IF;

  IF length(trim(staff_name)) < 2 THEN
    RAISE EXCEPTION 'Staff name is required';
  END IF;
  IF lower(trim(staff_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'A valid staff email is required';
  END IF;
  IF staff_role NOT IN ('admin', 'veterinarian', 'receptionist') THEN
    RAISE EXCEPTION 'Invalid staff role';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.staff
    WHERE clinic_id = caller_clinic_id
      AND lower(email) = lower(trim(staff_email))
  ) THEN
    RAISE EXCEPTION 'A staff member with this email already exists';
  END IF;

  RETURN QUERY
  INSERT INTO public.staff (clinic_id, name, email, role, status)
  VALUES (
    caller_clinic_id,
    trim(staff_name),
    lower(trim(staff_email)),
    staff_role,
    'pending'
  )
  RETURNING *;
END
$$;

REVOKE ALL ON FUNCTION public.admin_add_pending_staff(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_pending_staff(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_last_active_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'admin' AND OLD.status = 'active' THEN
    IF TG_OP = 'DELETE'
      OR (TG_OP = 'UPDATE' AND (NEW.role <> 'admin' OR NEW.status <> 'active')) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.staff
        WHERE clinic_id = OLD.clinic_id
          AND id <> OLD.id
          AND role = 'admin'
          AND status = 'active'
      ) THEN
        RAISE EXCEPTION 'A clinic must keep at least one active administrator';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS protect_last_active_admin_trigger ON public.staff;
DROP TRIGGER IF EXISTS protect_last_active_admin_update_trigger ON public.staff;
DROP TRIGGER IF EXISTS protect_last_active_admin_delete_trigger ON public.staff;
CREATE TRIGGER protect_last_active_admin_update_trigger
  BEFORE UPDATE OF role, status ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_active_admin();
CREATE TRIGGER protect_last_active_admin_delete_trigger
  BEFORE DELETE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_active_admin();

CREATE OR REPLACE FUNCTION public.sync_appointment_reminder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reminder_enabled boolean;
  hours_before integer;
  reminder_time timestamptz;
BEGIN
  UPDATE public.notification_queue
  SET
    status = 'cancelled',
    processing_started_at = NULL,
    error_message = CASE
      WHEN TG_OP = 'DELETE' THEN 'Appointment deleted'
      WHEN NEW.status <> 'scheduled' THEN 'Appointment no longer scheduled'
      ELSE 'Appointment rescheduled'
    END
  WHERE type = 'appointment_reminder'
    AND target_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
    AND status IN ('pending', 'processing');

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF NEW.status <> 'scheduled' THEN
    RETURN NEW;
  END IF;

  SELECT
    appointment_reminders_enabled,
    appointment_reminder_hours_before
  INTO reminder_enabled, hours_before
  FROM public.clinics
  WHERE id = NEW.clinic_id;

  reminder_time := NEW.scheduled_at - make_interval(hours => COALESCE(hours_before, 24));

  IF COALESCE(reminder_enabled, false) AND reminder_time > now() THEN
    INSERT INTO public.notification_queue (
      clinic_id, type, target_id, scheduled_for, status
    )
    VALUES (
      NEW.clinic_id, 'appointment_reminder', NEW.id, reminder_time, 'pending'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS appointment_reminder_insert_trigger ON public.appointments;
DROP TRIGGER IF EXISTS appointment_reminder_update_trigger ON public.appointments;
DROP TRIGGER IF EXISTS appointment_reminder_delete_trigger ON public.appointments;
CREATE TRIGGER appointment_reminder_insert_trigger
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_reminder();
CREATE TRIGGER appointment_reminder_update_trigger
  AFTER UPDATE OF scheduled_at, status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_reminder();
CREATE TRIGGER appointment_reminder_delete_trigger
  AFTER DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_reminder();

CREATE OR REPLACE FUNCTION public.sync_recall_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reminder_enabled boolean;
  days_before integer;
  clinic_timezone text;
  due_time timestamptz;
  candidate_time timestamptz;
BEGIN
  UPDATE public.notification_queue
  SET
    status = 'cancelled',
    processing_started_at = NULL,
    error_message = CASE
      WHEN TG_OP = 'DELETE' THEN 'Recall deleted'
      WHEN NEW.status = 'completed' THEN 'Recall completed'
      ELSE 'Recall rescheduled'
    END
  WHERE type = 'vaccine_reminder'
    AND target_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
    AND status IN ('pending', 'processing');

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF NEW.status = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT
    recall_reminders_enabled,
    recall_reminder_days_before,
    COALESCE(timezone, 'Europe/Belgrade')
  INTO reminder_enabled, days_before, clinic_timezone
  FROM public.clinics
  WHERE id = NEW.clinic_id;

  due_time := (NEW.due_date::date + time '09:00') AT TIME ZONE clinic_timezone;

  IF COALESCE(reminder_enabled, false) THEN
    FOREACH candidate_time IN ARRAY ARRAY[
      due_time - make_interval(days => COALESCE(days_before, 7)),
      due_time,
      due_time + interval '7 days'
    ]
    LOOP
      IF candidate_time > now() THEN
        INSERT INTO public.notification_queue (
          clinic_id, type, target_id, scheduled_for, status
        )
        VALUES (
          NEW.clinic_id, 'vaccine_reminder', NEW.id, candidate_time, 'pending'
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS recall_reminder_insert_trigger ON public.recalls;
DROP TRIGGER IF EXISTS recall_reminder_update_trigger ON public.recalls;
DROP TRIGGER IF EXISTS recall_reminder_delete_trigger ON public.recalls;
CREATE TRIGGER recall_reminder_insert_trigger
  AFTER INSERT ON public.recalls
  FOR EACH ROW EXECUTE FUNCTION public.sync_recall_reminders();
CREATE TRIGGER recall_reminder_update_trigger
  AFTER UPDATE OF due_date, status ON public.recalls
  FOR EACH ROW EXECUTE FUNCTION public.sync_recall_reminders();
CREATE TRIGGER recall_reminder_delete_trigger
  AFTER DELETE ON public.recalls
  FOR EACH ROW EXECUTE FUNCTION public.sync_recall_reminders();

CREATE OR REPLACE FUNCTION public.reschedule_clinic_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.appointments
  SET scheduled_at = scheduled_at
  WHERE clinic_id = NEW.id AND status = 'scheduled';

  UPDATE public.recalls
  SET due_date = due_date
  WHERE clinic_id = NEW.id AND status <> 'completed';

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS clinic_notification_settings_trigger ON public.clinics;
CREATE TRIGGER clinic_notification_settings_trigger
  AFTER UPDATE OF
    appointment_reminders_enabled,
    appointment_reminder_hours_before,
    recall_reminders_enabled,
    recall_reminder_days_before,
    timezone
  ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.reschedule_clinic_notifications();
