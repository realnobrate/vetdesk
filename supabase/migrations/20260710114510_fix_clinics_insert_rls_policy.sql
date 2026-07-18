-- Replace the unrestricted clinics INSERT policy.
-- A user may only create a clinic if they have no existing staff row,
-- i.e. they are provisioning themselves for the first time.
DROP POLICY IF EXISTS "staff_insert_clinic" ON clinics;
CREATE POLICY "staff_insert_clinic" ON clinics FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM staff WHERE user_id = auth.uid()
  )
);
