/*
# VetDesk Schema - Step 2: RLS Policies

Adds all row-level security policies now that all tables exist.
Staff membership in a clinic gates access to all clinic-scoped data.
*/

-- Helper: what clinic does the current user belong to?
-- Used in all cross-table policies via subquery.

-- ===== CLINICS =====
DROP POLICY IF EXISTS "staff_select_own_clinic" ON clinics;
CREATE POLICY "staff_select_own_clinic" ON clinics FOR SELECT
TO authenticated
USING (
  id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "staff_insert_clinic" ON clinics;
CREATE POLICY "staff_insert_clinic" ON clinics FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM staff WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "staff_update_own_clinic" ON clinics;
CREATE POLICY "staff_update_own_clinic" ON clinics FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT clinic_id FROM staff
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "staff_delete_clinic" ON clinics;
CREATE POLICY "staff_delete_clinic" ON clinics FOR DELETE
TO authenticated
USING (false);

-- ===== STAFF =====
DROP POLICY IF EXISTS "staff_select_same_clinic" ON staff;
CREATE POLICY "staff_select_same_clinic" ON staff FOR SELECT
TO authenticated
USING (
  clinic_id IN (SELECT clinic_id FROM staff s2 WHERE s2.user_id = auth.uid())
);

DROP POLICY IF EXISTS "staff_insert_self" ON staff;
CREATE POLICY "staff_insert_self" ON staff FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_update_own_or_admin" ON staff;
CREATE POLICY "staff_update_own_or_admin" ON staff FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR clinic_id IN (
    SELECT clinic_id FROM staff s2 WHERE s2.user_id = auth.uid() AND s2.role = 'admin'
  )
)
WITH CHECK (
  auth.uid() = user_id
  OR clinic_id IN (
    SELECT clinic_id FROM staff s2 WHERE s2.user_id = auth.uid() AND s2.role = 'admin'
  )
);

DROP POLICY IF EXISTS "staff_delete_self" ON staff;
CREATE POLICY "staff_delete_self" ON staff FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ===== OWNERS =====
DROP POLICY IF EXISTS "staff_select_owners" ON owners;
CREATE POLICY "staff_select_owners" ON owners FOR SELECT
TO authenticated
USING (clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "staff_insert_owners" ON owners;
CREATE POLICY "staff_insert_owners" ON owners FOR INSERT
TO authenticated
WITH CHECK (clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "staff_update_owners" ON owners;
CREATE POLICY "staff_update_owners" ON owners FOR UPDATE
TO authenticated
USING (clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid()))
WITH CHECK (clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "staff_delete_owners" ON owners;
CREATE POLICY "staff_delete_owners" ON owners FOR DELETE
TO authenticated
USING (clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid()));

-- ===== PETS =====
DROP POLICY IF EXISTS "staff_select_pets" ON pets;
CREATE POLICY "staff_select_pets" ON pets FOR SELECT
TO authenticated
USING (
  owner_id IN (
    SELECT id FROM owners
    WHERE clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_insert_pets" ON pets;
CREATE POLICY "staff_insert_pets" ON pets FOR INSERT
TO authenticated
WITH CHECK (
  owner_id IN (
    SELECT id FROM owners
    WHERE clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_update_pets" ON pets;
CREATE POLICY "staff_update_pets" ON pets FOR UPDATE
TO authenticated
USING (
  owner_id IN (
    SELECT id FROM owners
    WHERE clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  owner_id IN (
    SELECT id FROM owners
    WHERE clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_delete_pets" ON pets;
CREATE POLICY "staff_delete_pets" ON pets FOR DELETE
TO authenticated
USING (
  owner_id IN (
    SELECT id FROM owners
    WHERE clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

-- ===== VISITS =====
DROP POLICY IF EXISTS "staff_select_visits" ON visits;
CREATE POLICY "staff_select_visits" ON visits FOR SELECT
TO authenticated
USING (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_insert_visits" ON visits;
CREATE POLICY "staff_insert_visits" ON visits FOR INSERT
TO authenticated
WITH CHECK (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_update_visits" ON visits;
CREATE POLICY "staff_update_visits" ON visits FOR UPDATE
TO authenticated
USING (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_delete_visits" ON visits;
CREATE POLICY "staff_delete_visits" ON visits FOR DELETE
TO authenticated
USING (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

-- ===== RECALLS =====
DROP POLICY IF EXISTS "staff_select_recalls" ON recalls;
CREATE POLICY "staff_select_recalls" ON recalls FOR SELECT
TO authenticated
USING (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_insert_recalls" ON recalls;
CREATE POLICY "staff_insert_recalls" ON recalls FOR INSERT
TO authenticated
WITH CHECK (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_update_recalls" ON recalls;
CREATE POLICY "staff_update_recalls" ON recalls FOR UPDATE
TO authenticated
USING (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_delete_recalls" ON recalls;
CREATE POLICY "staff_delete_recalls" ON recalls FOR DELETE
TO authenticated
USING (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

-- ===== APPOINTMENTS =====
DROP POLICY IF EXISTS "staff_select_appointments" ON appointments;
CREATE POLICY "staff_select_appointments" ON appointments FOR SELECT
TO authenticated
USING (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_insert_appointments" ON appointments;
CREATE POLICY "staff_insert_appointments" ON appointments FOR INSERT
TO authenticated
WITH CHECK (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_update_appointments" ON appointments;
CREATE POLICY "staff_update_appointments" ON appointments FOR UPDATE
TO authenticated
USING (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_delete_appointments" ON appointments;
CREATE POLICY "staff_delete_appointments" ON appointments FOR DELETE
TO authenticated
USING (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);
