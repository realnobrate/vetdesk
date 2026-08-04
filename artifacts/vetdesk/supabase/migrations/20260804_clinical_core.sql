-- VetDesk clinical core: auditable medical records, vaccinations,
-- prescriptions, laboratory orders, private documents, and soft deletion.
-- Apply after all 20260803 hardening migrations.

ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS clinic_id bigint,
  ADD COLUMN IF NOT EXISTS microchip_number text,
  ADD COLUMN IF NOT EXISTS allergies text,
  ADD COLUMN IF NOT EXISTS chronic_conditions text,
  ADD COLUMN IF NOT EXISTS important_warnings text,
  ADD COLUMN IF NOT EXISTS insurance_provider text,
  ADD COLUMN IF NOT EXISTS insurance_policy_number text,
  ADD COLUMN IF NOT EXISTS reproductive_status text,
  ADD COLUMN IF NOT EXISTS is_deceased boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deceased_on date,
  ADD COLUMN IF NOT EXISTS cause_of_death text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.pets AS pet
SET clinic_id = owner.clinic_id
FROM public.owners AS owner
WHERE owner.id = pet.owner_id AND pet.clinic_id IS NULL;

ALTER TABLE public.pets ALTER COLUMN clinic_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pets_clinic_id_fkey'
  ) THEN
    ALTER TABLE public.pets
      ADD CONSTRAINT pets_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pets_reproductive_status_check'
  ) THEN
    ALTER TABLE public.pets
      ADD CONSTRAINT pets_reproductive_status_check
      CHECK (
        reproductive_status IS NULL OR reproductive_status IN (
          'intact', 'neutered', 'spayed', 'unknown'
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pets_deceased_data_check'
  ) THEN
    ALTER TABLE public.pets
      ADD CONSTRAINT pets_deceased_data_check
      CHECK (is_deceased OR (deceased_on IS NULL AND cause_of_death IS NULL));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS pets_clinic_microchip_unique
  ON public.pets(clinic_id, lower(microchip_number))
  WHERE microchip_number IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS pets_clinic_active_idx
  ON public.pets(clinic_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS owners_clinic_active_idx
  ON public.owners(clinic_id, last_name, first_name) WHERE deleted_at IS NULL;

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS clinic_id bigint,
  ADD COLUMN IF NOT EXISTS attending_staff_id bigint REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS presenting_complaint text,
  ADD COLUMN IF NOT EXISTS subjective_notes text,
  ADD COLUMN IF NOT EXISTS objective_notes text,
  ADD COLUMN IF NOT EXISTS assessment text,
  ADD COLUMN IF NOT EXISTS differential_diagnosis text,
  ADD COLUMN IF NOT EXISTS treatment_plan text,
  ADD COLUMN IF NOT EXISTS follow_up_recommendations text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS temperature_celsius numeric(4,1),
  ADD COLUMN IF NOT EXISTS heart_rate_bpm integer,
  ADD COLUMN IF NOT EXISTS respiratory_rate_bpm integer,
  ADD COLUMN IF NOT EXISTS body_condition_score numeric(3,1),
  ADD COLUMN IF NOT EXISTS record_status text NOT NULL DEFAULT 'final',
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.visits AS visit
SET clinic_id = pet.clinic_id
FROM public.pets AS pet
WHERE pet.id = visit.pet_id AND visit.clinic_id IS NULL;

UPDATE public.visits
SET finalized_at = COALESCE(finalized_at, created_at)
WHERE record_status = 'final';

ALTER TABLE public.visits ALTER COLUMN clinic_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visits_clinic_id_fkey'
  ) THEN
    ALTER TABLE public.visits
      ADD CONSTRAINT visits_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visits_record_status_check'
  ) THEN
    ALTER TABLE public.visits
      ADD CONSTRAINT visits_record_status_check
      CHECK (record_status IN ('draft', 'final', 'amended'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visits_vitals_check'
  ) THEN
    ALTER TABLE public.visits
      ADD CONSTRAINT visits_vitals_check
      CHECK (
        (temperature_celsius IS NULL OR temperature_celsius BETWEEN 20 AND 50)
        AND (heart_rate_bpm IS NULL OR heart_rate_bpm BETWEEN 1 AND 400)
        AND (respiratory_rate_bpm IS NULL OR respiratory_rate_bpm BETWEEN 1 AND 300)
        AND (body_condition_score IS NULL OR body_condition_score BETWEEN 1 AND 9)
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS visits_clinic_pet_date_idx
  ON public.visits(clinic_id, pet_id, visit_date DESC);

CREATE TABLE IF NOT EXISTS public.medical_note_templates (
  id bigserial PRIMARY KEY,
  clinic_id bigint NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  name text NOT NULL,
  presenting_complaint text,
  subjective_notes text,
  objective_notes text,
  assessment text,
  treatment_plan text,
  follow_up_recommendations text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (clinic_id, name)
);

CREATE TABLE IF NOT EXISTS public.vaccinations (
  id bigserial PRIMARY KEY,
  clinic_id bigint NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  pet_id bigint NOT NULL REFERENCES public.pets(id) ON DELETE RESTRICT,
  visit_id bigint REFERENCES public.visits(id) ON DELETE SET NULL,
  recall_id bigint REFERENCES public.recalls(id) ON DELETE SET NULL,
  vaccine_name text NOT NULL,
  manufacturer text,
  lot_number text,
  expires_on date,
  administered_on date NOT NULL,
  administration_site text,
  veterinarian_staff_id bigint REFERENCES public.staff(id) ON DELETE SET NULL,
  next_due_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (expires_on IS NULL OR expires_on >= administered_on)
);

CREATE INDEX IF NOT EXISTS vaccinations_pet_date_idx
  ON public.vaccinations(pet_id, administered_on DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS vaccinations_clinic_due_idx
  ON public.vaccinations(clinic_id, next_due_date) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.prescriptions (
  id bigserial PRIMARY KEY,
  clinic_id bigint NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  pet_id bigint NOT NULL REFERENCES public.pets(id) ON DELETE RESTRICT,
  visit_id bigint REFERENCES public.visits(id) ON DELETE SET NULL,
  medication_name text NOT NULL,
  dosage text NOT NULL,
  frequency text NOT NULL,
  duration text,
  route text,
  instructions text NOT NULL,
  starts_on date NOT NULL DEFAULT current_date,
  ends_on date,
  prescriber_staff_id bigint REFERENCES public.staff(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  refills_allowed integer NOT NULL DEFAULT 0,
  refills_remaining integer NOT NULL DEFAULT 0,
  medication_warnings text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  discontinued_at timestamptz,
  deleted_at timestamptz,
  CHECK (status IN ('active', 'completed', 'discontinued')),
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CHECK (refills_allowed >= 0 AND refills_remaining BETWEEN 0 AND refills_allowed)
);

CREATE INDEX IF NOT EXISTS prescriptions_pet_status_idx
  ON public.prescriptions(pet_id, status, starts_on DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.lab_orders (
  id bigserial PRIMARY KEY,
  clinic_id bigint NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  pet_id bigint NOT NULL REFERENCES public.pets(id) ON DELETE RESTRICT,
  visit_id bigint REFERENCES public.visits(id) ON DELETE SET NULL,
  ordered_by_staff_id bigint REFERENCES public.staff(id) ON DELETE SET NULL,
  reviewed_by_staff_id bigint REFERENCES public.staff(id) ON DELETE SET NULL,
  test_name text NOT NULL,
  category text NOT NULL,
  laboratory_type text NOT NULL DEFAULT 'internal',
  laboratory_name text,
  sample_type text,
  sample_collected_at timestamptz,
  status text NOT NULL DEFAULT 'ordered',
  result_text text,
  result_numeric numeric,
  result_unit text,
  reference_range text,
  is_abnormal boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  owner_notified_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (laboratory_type IN ('internal', 'external')),
  CHECK (status IN ('ordered', 'collected', 'processing', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS lab_orders_pet_status_idx
  ON public.lab_orders(pet_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS lab_orders_clinic_review_idx
  ON public.lab_orders(clinic_id, reviewed_at, created_at DESC)
  WHERE status = 'completed' AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.clinical_documents (
  id bigserial PRIMARY KEY,
  clinic_id bigint NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  pet_id bigint NOT NULL REFERENCES public.pets(id) ON DELETE RESTRICT,
  visit_id bigint REFERENCES public.visits(id) ON DELETE SET NULL,
  lab_order_id bigint REFERENCES public.lab_orders(id) ON DELETE SET NULL,
  document_type text NOT NULL,
  display_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  client_visible boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp'))
);

CREATE INDEX IF NOT EXISTS clinical_documents_pet_idx
  ON public.clinical_documents(pet_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigserial PRIMARY KEY,
  clinic_id bigint NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_staff_id bigint REFERENCES public.staff(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  previous_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_clinic_created_idx
  ON public.audit_log(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx
  ON public.audit_log(clinic_id, entity_type, entity_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.write_vetdesk_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  source_row jsonb;
  previous_row jsonb;
  next_row jsonb;
  source_clinic_id bigint;
  source_staff_id bigint;
BEGIN
  source_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  previous_row := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) - 'photo_url' ELSE NULL END;
  next_row := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) - 'photo_url' ELSE NULL END;

  source_clinic_id := NULLIF(source_row->>'clinic_id', '')::bigint;
  IF source_clinic_id IS NULL AND TG_TABLE_NAME = 'clinics' THEN
    source_clinic_id := NULLIF(source_row->>'id', '')::bigint;
  END IF;
  IF source_clinic_id IS NULL AND source_row ? 'owner_id' THEN
    SELECT clinic_id INTO source_clinic_id
    FROM public.owners
    WHERE id = (source_row->>'owner_id')::bigint;
  END IF;
  IF source_clinic_id IS NULL AND source_row ? 'pet_id' THEN
    SELECT clinic_id INTO source_clinic_id
    FROM public.pets
    WHERE id = (source_row->>'pet_id')::bigint;
  END IF;

  IF source_clinic_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT id INTO source_staff_id
  FROM public.staff
  WHERE user_id = auth.uid() AND clinic_id = source_clinic_id
  LIMIT 1;

  INSERT INTO public.audit_log (
    clinic_id, actor_user_id, actor_staff_id, action, entity_type,
    entity_id, previous_values, new_values
  )
  VALUES (
    source_clinic_id,
    auth.uid(),
    source_staff_id,
    lower(TG_OP),
    TG_TABLE_NAME,
    COALESCE(source_row->>'id', 'unknown'),
    previous_row,
    next_row
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.write_vetdesk_audit_log() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.prevent_clinical_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Clinical and business records must be archived, not permanently deleted';
END
$$;

CREATE OR REPLACE FUNCTION public.protect_pet_clinical_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'veterinarian')
    AND (
      NEW.microchip_number IS DISTINCT FROM OLD.microchip_number
      OR NEW.allergies IS DISTINCT FROM OLD.allergies
      OR NEW.chronic_conditions IS DISTINCT FROM OLD.chronic_conditions
      OR NEW.important_warnings IS DISTINCT FROM OLD.important_warnings
      OR NEW.insurance_provider IS DISTINCT FROM OLD.insurance_provider
      OR NEW.insurance_policy_number IS DISTINCT FROM OLD.insurance_policy_number
      OR NEW.reproductive_status IS DISTINCT FROM OLD.reproductive_status
      OR NEW.is_deceased IS DISTINCT FROM OLD.is_deceased
      OR NEW.deceased_on IS DISTINCT FROM OLD.deceased_on
      OR NEW.cause_of_death IS DISTINCT FROM OLD.cause_of_death
      OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
      OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by
    ) THEN
    RAISE EXCEPTION 'Only veterinarians and clinic administrators can change clinical profile fields';
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.protect_owner_archive_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by)
    AND public.current_staff_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only clinic administrators can archive or restore client records';
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.mark_final_visit_amended()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.record_status = 'final'
    AND (
      NEW.presenting_complaint IS DISTINCT FROM OLD.presenting_complaint
      OR NEW.subjective_notes IS DISTINCT FROM OLD.subjective_notes
      OR NEW.objective_notes IS DISTINCT FROM OLD.objective_notes
      OR NEW.assessment IS DISTINCT FROM OLD.assessment
      OR NEW.differential_diagnosis IS DISTINCT FROM OLD.differential_diagnosis
      OR NEW.treatment_plan IS DISTINCT FROM OLD.treatment_plan
      OR NEW.follow_up_recommendations IS DISTINCT FROM OLD.follow_up_recommendations
      OR NEW.internal_notes IS DISTINCT FROM OLD.internal_notes
      OR NEW.temperature_celsius IS DISTINCT FROM OLD.temperature_celsius
      OR NEW.heart_rate_bpm IS DISTINCT FROM OLD.heart_rate_bpm
      OR NEW.respiratory_rate_bpm IS DISTINCT FROM OLD.respiratory_rate_bpm
      OR NEW.body_condition_score IS DISTINCT FROM OLD.body_condition_score
    ) THEN
    NEW.record_status := 'amended';
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.validate_clinical_relationships()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  related_clinic_id bigint;
  related_pet_id bigint;
BEGIN
  SELECT clinic_id INTO related_clinic_id FROM public.pets WHERE id = NEW.pet_id;
  IF related_clinic_id IS NULL OR related_clinic_id <> NEW.clinic_id THEN
    RAISE EXCEPTION 'The patient does not belong to the selected clinic';
  END IF;

  IF NEW.visit_id IS NOT NULL THEN
    SELECT clinic_id, pet_id INTO related_clinic_id, related_pet_id
    FROM public.visits WHERE id = NEW.visit_id;
    IF related_clinic_id IS NULL
      OR related_clinic_id <> NEW.clinic_id
      OR related_pet_id <> NEW.pet_id THEN
      RAISE EXCEPTION 'The visit does not belong to this patient and clinic';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'vaccinations' AND NEW.recall_id IS NOT NULL THEN
    SELECT clinic_id, pet_id INTO related_clinic_id, related_pet_id
    FROM public.recalls WHERE id = NEW.recall_id;
    IF related_clinic_id IS NULL
      OR related_clinic_id <> NEW.clinic_id
      OR related_pet_id <> NEW.pet_id THEN
      RAISE EXCEPTION 'The recall does not belong to this patient and clinic';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'clinical_documents' AND NEW.lab_order_id IS NOT NULL THEN
    SELECT clinic_id, pet_id INTO related_clinic_id, related_pet_id
    FROM public.lab_orders WHERE id = NEW.lab_order_id;
    IF related_clinic_id IS NULL
      OR related_clinic_id <> NEW.clinic_id
      OR related_pet_id <> NEW.pet_id THEN
      RAISE EXCEPTION 'The lab order does not belong to this patient and clinic';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_pet(target_pet_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_clinic_id bigint;
BEGIN
  SELECT clinic_id INTO target_clinic_id
  FROM public.pets WHERE id = target_pet_id AND deleted_at IS NULL;

  IF target_clinic_id IS NULL OR NOT public.is_current_clinic_admin(target_clinic_id) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  UPDATE public.pets
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = target_pet_id AND clinic_id = target_clinic_id;
END
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_owner(target_owner_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_clinic_id bigint;
BEGIN
  SELECT clinic_id INTO target_clinic_id
  FROM public.owners WHERE id = target_owner_id AND deleted_at IS NULL;

  IF target_clinic_id IS NULL OR NOT public.is_current_clinic_admin(target_clinic_id) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  UPDATE public.pets
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE owner_id = target_owner_id AND clinic_id = target_clinic_id;

  UPDATE public.owners
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = target_owner_id AND clinic_id = target_clinic_id;
END
$$;

CREATE OR REPLACE FUNCTION public.restore_archived_pet(target_pet_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_clinic_id bigint;
BEGIN
  SELECT clinic_id INTO target_clinic_id FROM public.pets WHERE id = target_pet_id;
  IF target_clinic_id IS NULL OR NOT public.is_current_clinic_admin(target_clinic_id) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  UPDATE public.pets SET deleted_at = NULL, deleted_by = NULL WHERE id = target_pet_id;
END
$$;

CREATE OR REPLACE FUNCTION public.restore_archived_owner(target_owner_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_clinic_id bigint;
BEGIN
  SELECT clinic_id INTO target_clinic_id FROM public.owners WHERE id = target_owner_id;
  IF target_clinic_id IS NULL OR NOT public.is_current_clinic_admin(target_clinic_id) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  UPDATE public.owners SET deleted_at = NULL, deleted_by = NULL WHERE id = target_owner_id;
  UPDATE public.pets SET deleted_at = NULL, deleted_by = NULL
  WHERE owner_id = target_owner_id AND clinic_id = target_clinic_id;
END
$$;

REVOKE ALL ON FUNCTION public.soft_delete_pet(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_owner(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_archived_pet(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_archived_owner(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_pet(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_owner(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_archived_pet(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_archived_owner(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_current_clinic_pet(target_pet_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pets
    WHERE id = target_pet_id
      AND clinic_id = public.current_staff_clinic_id()
      AND deleted_at IS NULL
  )
$$;

REVOKE ALL ON FUNCTION public.is_current_clinic_pet(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_clinic_pet(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_vaccination_recall()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_recall_id bigint;
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.next_due_date IS NULL THEN
    IF NEW.recall_id IS NOT NULL THEN
      UPDATE public.recalls
      SET status = 'completed', completed_at = COALESCE(completed_at, now())
      WHERE id = NEW.recall_id;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.recall_id IS NULL THEN
    INSERT INTO public.recalls (
      pet_id, clinic_id, visit_id, recall_type, due_date, status, notes
    )
    VALUES (
      NEW.pet_id,
      NEW.clinic_id,
      NEW.visit_id,
      NEW.vaccine_name,
      NEW.next_due_date,
      'upcoming',
      'Automatically created from vaccination record'
    )
    RETURNING id INTO new_recall_id;

    UPDATE public.vaccinations SET recall_id = new_recall_id WHERE id = NEW.id;
  ELSE
    UPDATE public.recalls
    SET
      recall_type = NEW.vaccine_name,
      due_date = NEW.next_due_date,
      visit_id = NEW.visit_id,
      status = CASE WHEN status = 'completed' THEN 'upcoming' ELSE status END,
      completed_at = CASE WHEN status = 'completed' THEN NULL ELSE completed_at END
    WHERE id = NEW.recall_id;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS vaccination_recall_insert_trigger ON public.vaccinations;
DROP TRIGGER IF EXISTS vaccination_recall_update_trigger ON public.vaccinations;
CREATE TRIGGER vaccination_recall_insert_trigger
  AFTER INSERT ON public.vaccinations
  FOR EACH ROW EXECUTE FUNCTION public.sync_vaccination_recall();
CREATE TRIGGER vaccination_recall_update_trigger
  AFTER UPDATE OF vaccine_name, next_due_date, deleted_at ON public.vaccinations
  FOR EACH ROW EXECUTE FUNCTION public.sync_vaccination_recall();

DROP TRIGGER IF EXISTS visits_updated_at_trigger ON public.visits;
DROP TRIGGER IF EXISTS pets_protect_clinical_fields_trigger ON public.pets;
DROP TRIGGER IF EXISTS owners_protect_archive_fields_trigger ON public.owners;
DROP TRIGGER IF EXISTS visits_mark_amended_trigger ON public.visits;
CREATE TRIGGER owners_protect_archive_fields_trigger
  BEFORE UPDATE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.protect_owner_archive_fields();
CREATE TRIGGER pets_protect_clinical_fields_trigger
  BEFORE UPDATE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.protect_pet_clinical_fields();
CREATE TRIGGER visits_mark_amended_trigger
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.mark_final_visit_amended();
CREATE TRIGGER visits_updated_at_trigger
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'medical_note_templates', 'vaccinations', 'prescriptions',
    'lab_orders'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at_trigger ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER %I_updated_at_trigger BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      table_name,
      table_name
    );
  END LOOP;
END
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'vaccinations', 'prescriptions', 'lab_orders', 'clinical_documents'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS validate_clinical_relationships_trigger ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER validate_clinical_relationships_trigger BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.validate_clinical_relationships()',
      table_name
    );
  END LOOP;
END
$$;

ALTER TABLE public.medical_note_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owners_own_clinic ON public.owners;
DROP POLICY IF EXISTS pets_own_clinic ON public.pets;
CREATE POLICY owners_clinic_read ON public.owners
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_staff_clinic_id() AND deleted_at IS NULL);
CREATE POLICY owners_clinic_insert ON public.owners
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_staff_clinic_id() AND deleted_at IS NULL);
CREATE POLICY owners_clinic_update ON public.owners
  FOR UPDATE TO authenticated
  USING (clinic_id = public.current_staff_clinic_id() AND deleted_at IS NULL)
  WITH CHECK (clinic_id = public.current_staff_clinic_id());

CREATE POLICY pets_clinic_read ON public.pets
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_staff_clinic_id() AND deleted_at IS NULL);
CREATE POLICY pets_clinic_insert ON public.pets
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.owners
      WHERE owners.id = pets.owner_id
        AND owners.clinic_id = public.current_staff_clinic_id()
        AND owners.deleted_at IS NULL
    )
  );
CREATE POLICY pets_clinic_update ON public.pets
  FOR UPDATE TO authenticated
  USING (clinic_id = public.current_staff_clinic_id() AND deleted_at IS NULL)
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND EXISTS (
      SELECT 1 FROM public.owners
      WHERE owners.id = pets.owner_id
        AND owners.clinic_id = public.current_staff_clinic_id()
        AND owners.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS visits_own_clinic ON public.visits;
CREATE POLICY visits_clinic_read ON public.visits
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_staff_clinic_id());
CREATE POLICY visits_clinical_insert ON public.visits
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
    AND EXISTS (
      SELECT 1 FROM public.pets
      WHERE pets.id = visits.pet_id
        AND pets.clinic_id = public.current_staff_clinic_id()
        AND pets.deleted_at IS NULL
    )
  );
CREATE POLICY visits_clinical_update ON public.visits
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
  )
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
    AND public.is_current_clinic_pet(pet_id)
  );

CREATE POLICY medical_templates_read ON public.medical_note_templates
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_staff_clinic_id() AND archived_at IS NULL);
CREATE POLICY medical_templates_insert ON public.medical_note_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
  );
CREATE POLICY medical_templates_update ON public.medical_note_templates
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
  )
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
  );

CREATE POLICY vaccinations_read ON public.vaccinations
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_staff_clinic_id() AND deleted_at IS NULL);
CREATE POLICY vaccinations_write ON public.vaccinations
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
    AND public.is_current_clinic_pet(pet_id)
  );
CREATE POLICY vaccinations_update ON public.vaccinations
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
  )
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
    AND public.is_current_clinic_pet(pet_id)
  );

CREATE POLICY prescriptions_read ON public.prescriptions
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_staff_clinic_id() AND deleted_at IS NULL);
CREATE POLICY prescriptions_write ON public.prescriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
    AND public.is_current_clinic_pet(pet_id)
  );
CREATE POLICY prescriptions_update ON public.prescriptions
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
    AND public.is_current_clinic_pet(pet_id)
  )
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
    AND public.is_current_clinic_pet(pet_id)
  );

CREATE POLICY lab_orders_read ON public.lab_orders
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_staff_clinic_id() AND deleted_at IS NULL);
CREATE POLICY lab_orders_write ON public.lab_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
    AND public.is_current_clinic_pet(pet_id)
  );
CREATE POLICY lab_orders_update ON public.lab_orders
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
    AND public.is_current_clinic_pet(pet_id)
  )
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
    AND public.is_current_clinic_pet(pet_id)
  );

CREATE POLICY clinical_documents_read ON public.clinical_documents
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_staff_clinic_id() AND deleted_at IS NULL);
CREATE POLICY clinical_documents_write ON public.clinical_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
    AND public.is_current_clinic_pet(pet_id)
  );
CREATE POLICY clinical_documents_update ON public.clinical_documents
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
    AND public.is_current_clinic_pet(pet_id)
  )
  WITH CHECK (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() IN ('admin', 'veterinarian')
    AND public.is_current_clinic_pet(pet_id)
  );

CREATE POLICY audit_log_admin_read ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.current_staff_clinic_id()
    AND public.current_staff_role() = 'admin'
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM anon, authenticated;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'clinics', 'staff', 'owners', 'pets', 'visits', 'appointments',
    'recalls', 'medical_note_templates', 'vaccinations', 'prescriptions',
    'lab_orders', 'clinical_documents'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS vetdesk_audit_trigger ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER vetdesk_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.write_vetdesk_audit_log()',
      table_name
    );
  END LOOP;
END
$$;

DROP TRIGGER IF EXISTS owners_prevent_hard_delete ON public.owners;
DROP TRIGGER IF EXISTS pets_prevent_hard_delete ON public.pets;
DROP TRIGGER IF EXISTS visits_prevent_hard_delete ON public.visits;
DROP TRIGGER IF EXISTS vaccinations_prevent_hard_delete ON public.vaccinations;
DROP TRIGGER IF EXISTS prescriptions_prevent_hard_delete ON public.prescriptions;
DROP TRIGGER IF EXISTS lab_orders_prevent_hard_delete ON public.lab_orders;
DROP TRIGGER IF EXISTS clinical_documents_prevent_hard_delete ON public.clinical_documents;
CREATE TRIGGER owners_prevent_hard_delete BEFORE DELETE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.prevent_clinical_hard_delete();
CREATE TRIGGER pets_prevent_hard_delete BEFORE DELETE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.prevent_clinical_hard_delete();
CREATE TRIGGER visits_prevent_hard_delete BEFORE DELETE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.prevent_clinical_hard_delete();
CREATE TRIGGER vaccinations_prevent_hard_delete BEFORE DELETE ON public.vaccinations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_clinical_hard_delete();
CREATE TRIGGER prescriptions_prevent_hard_delete BEFORE DELETE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_clinical_hard_delete();
CREATE TRIGGER lab_orders_prevent_hard_delete BEFORE DELETE ON public.lab_orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_clinical_hard_delete();
CREATE TRIGGER clinical_documents_prevent_hard_delete BEFORE DELETE ON public.clinical_documents
  FOR EACH ROW EXECUTE FUNCTION public.prevent_clinical_hard_delete();

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
VALUES (
  'medical-documents',
  'medical-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.can_access_medical_document(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    object_name ~ '^clinics/[0-9]+/pets/[0-9]+/'
    AND substring(object_name FROM '^clinics/([0-9]+)/')::bigint = public.current_staff_clinic_id()
    AND EXISTS (
      SELECT 1 FROM public.pets
      WHERE id = substring(object_name FROM '/pets/([0-9]+)/')::bigint
        AND clinic_id = public.current_staff_clinic_id()
        AND deleted_at IS NULL
    )
$$;

REVOKE ALL ON FUNCTION public.can_access_medical_document(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_medical_document(text) TO authenticated;

DROP POLICY IF EXISTS vetdesk_medical_documents_read ON storage.objects;
DROP POLICY IF EXISTS vetdesk_medical_documents_insert ON storage.objects;
DROP POLICY IF EXISTS vetdesk_medical_documents_update ON storage.objects;
DROP POLICY IF EXISTS vetdesk_medical_documents_delete ON storage.objects;
CREATE POLICY vetdesk_medical_documents_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'medical-documents'
    AND public.can_access_medical_document(name)
  );
CREATE POLICY vetdesk_medical_documents_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'medical-documents'
    AND public.can_access_medical_document(name)
    AND public.current_staff_role() IN ('admin', 'veterinarian')
    AND lower(COALESCE(metadata->>'mimetype', '')) IN (
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
    )
  );
CREATE POLICY vetdesk_medical_documents_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'medical-documents'
    AND public.can_access_medical_document(name)
    AND public.current_staff_role() IN ('admin', 'veterinarian')
  )
  WITH CHECK (
    bucket_id = 'medical-documents'
    AND public.can_access_medical_document(name)
    AND public.current_staff_role() IN ('admin', 'veterinarian')
  );
CREATE POLICY vetdesk_medical_documents_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'medical-documents'
    AND public.can_access_medical_document(name)
    AND public.current_staff_role() IN ('admin', 'veterinarian')
  );
