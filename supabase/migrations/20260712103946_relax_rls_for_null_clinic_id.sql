/*
# Relax RLS policies to allow access when clinic_id is NULL

## Problem
All list/query functions filter by clinic_id, but clinic_id is nullable
on owners and staff. When clinic_id is NULL, the RLS policies reject
access because NULL IN (SELECT ...) evaluates to NULL (not true).

## Fix
Update all RLS policies to allow access when the record's clinic_id is NULL
OR when it matches the user's clinic_id. Temporary until a real clinics
system is implemented.

## Security note
This relaxes isolation for rows with NULL clinic_id only. Rows with a
non-null clinic_id remain fully isolated to staff of that clinic.
*/

-- ===== OWNERS =====
DROP POLICY IF EXISTS "staff_select_owners" ON owners;
CREATE POLICY "staff_select_owners" ON owners FOR SELECT
TO authenticated
USING (
  clinic_id IS NULL
  OR clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "staff_insert_owners" ON owners;
CREATE POLICY "staff_insert_owners" ON owners FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id IS NULL
  OR clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "staff_update_owners" ON owners;
CREATE POLICY "staff_update_owners" ON owners FOR UPDATE
TO authenticated
USING (
  clinic_id IS NULL
  OR clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
)
WITH CHECK (
  clinic_id IS NULL
  OR clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "staff_delete_owners" ON owners;
CREATE POLICY "staff_delete_owners" ON owners FOR DELETE
TO authenticated
USING (
  clinic_id IS NULL
  OR clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
);

-- ===== PETS =====
DROP POLICY IF EXISTS "staff_select_pets" ON pets;
CREATE POLICY "staff_select_pets" ON pets FOR SELECT
TO authenticated
USING (
  owner_id IN (
    SELECT id FROM owners
    WHERE clinic_id IS NULL
      OR clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_insert_pets" ON pets;
CREATE POLICY "staff_insert_pets" ON pets FOR INSERT
TO authenticated
WITH CHECK (
  owner_id IN (
    SELECT id FROM owners
    WHERE clinic_id IS NULL
      OR clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_update_pets" ON pets;
CREATE POLICY "staff_update_pets" ON pets FOR UPDATE
TO authenticated
USING (
  owner_id IN (
    SELECT id FROM owners
    WHERE clinic_id IS NULL
      OR clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  owner_id IN (
    SELECT id FROM owners
    WHERE clinic_id IS NULL
      OR clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_delete_pets" ON pets;
CREATE POLICY "staff_delete_pets" ON pets FOR DELETE
TO authenticated
USING (
  owner_id IN (
    SELECT id FROM owners
    WHERE clinic_id IS NULL
      OR clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
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
    WHERE o.clinic_id IS NULL
      OR o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_insert_visits" ON visits;
CREATE POLICY "staff_insert_visits" ON visits FOR INSERT
TO authenticated
WITH CHECK (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IS NULL
      OR o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_update_visits" ON visits;
CREATE POLICY "staff_update_visits" ON visits FOR UPDATE
TO authenticated
USING (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IS NULL
      OR o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IS NULL
      OR o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_delete_visits" ON visits;
CREATE POLICY "staff_delete_visits" ON visits FOR DELETE
TO authenticated
USING (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IS NULL
      OR o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
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
    WHERE o.clinic_id IS NULL
      OR o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_insert_recalls" ON recalls;
CREATE POLICY "staff_insert_recalls" ON recalls FOR INSERT
TO authenticated
WITH CHECK (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IS NULL
      OR o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_update_recalls" ON recalls;
CREATE POLICY "staff_update_recalls" ON recalls FOR UPDATE
TO authenticated
USING (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IS NULL
      OR o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IS NULL
      OR o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_delete_recalls" ON recalls;
CREATE POLICY "staff_delete_recalls" ON recalls FOR DELETE
TO authenticated
USING (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IS NULL
      OR o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
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
    WHERE o.clinic_id IS NULL
      OR o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_insert_appointments" ON appointments;
CREATE POLICY "staff_insert_appointments" ON appointments FOR INSERT
TO authenticated
WITH CHECK (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IS NULL
      OR o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_update_appointments" ON appointments;
CREATE POLICY "staff_update_appointments" ON appointments FOR UPDATE
TO authenticated
USING (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IS NULL
      OR o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IS NULL
      OR o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_delete_appointments" ON appointments;
CREATE POLICY "staff_delete_appointments" ON appointments FOR DELETE
TO authenticated
USING (
  pet_id IN (
    SELECT p.id FROM pets p
    JOIN owners o ON p.owner_id = o.id
    WHERE o.clinic_id IS NULL
      OR o.clinic_id IN (SELECT clinic_id FROM staff WHERE user_id = auth.uid())
  )
);

-- ===== STAFF (relax SELECT to allow seeing staff with null clinic_id) =====
DROP POLICY IF EXISTS "staff_select_same_clinic" ON staff;
CREATE POLICY "staff_select_same_clinic" ON staff FOR SELECT
TO authenticated
USING (
  clinic_id IS NULL
  OR clinic_id IN (SELECT clinic_id FROM staff s2 WHERE s2.user_id = auth.uid())
);