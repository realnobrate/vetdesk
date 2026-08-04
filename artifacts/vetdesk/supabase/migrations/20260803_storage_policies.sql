-- Restrict VetDesk storage writes to the authenticated user's clinic.
-- Pet photos become private; clinic branding assets intentionally remain public.

CREATE OR REPLACE FUNCTION public.can_access_pet_photo(object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  record_id bigint;
BEGIN
  IF object_name ~ '^pets/[0-9]+-' THEN
    record_id := substring(object_name FROM '^pets/([0-9]+)-')::bigint;
    RETURN EXISTS (
      SELECT 1
      FROM public.pets
      JOIN public.owners ON owners.id = pets.owner_id
      WHERE pets.id = record_id
        AND owners.clinic_id = public.current_staff_clinic_id()
    );
  END IF;

  IF object_name ~ '^visits/[0-9]+/' THEN
    record_id := substring(object_name FROM '^visits/([0-9]+)/')::bigint;
    RETURN EXISTS (
      SELECT 1
      FROM public.visits
      JOIN public.pets ON pets.id = visits.pet_id
      JOIN public.owners ON owners.id = pets.owner_id
      WHERE visits.id = record_id
        AND owners.clinic_id = public.current_staff_clinic_id()
    );
  END IF;

  RETURN false;
END
$$;

CREATE OR REPLACE FUNCTION public.can_access_clinic_asset(object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clinic_id_from_path bigint;
BEGIN
  IF object_name !~ '^clinics/[0-9]+/' THEN
    RETURN false;
  END IF;

  clinic_id_from_path := substring(object_name FROM '^clinics/([0-9]+)/')::bigint;
  RETURN public.is_current_clinic_admin(clinic_id_from_path);
END
$$;

REVOKE ALL ON FUNCTION public.can_access_pet_photo(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_clinic_asset(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_pet_photo(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_clinic_asset(text) TO authenticated;

DROP POLICY IF EXISTS vetdesk_pet_photos_read ON storage.objects;
DROP POLICY IF EXISTS vetdesk_pet_photos_insert ON storage.objects;
DROP POLICY IF EXISTS vetdesk_pet_photos_update ON storage.objects;
DROP POLICY IF EXISTS vetdesk_pet_photos_delete ON storage.objects;
DROP POLICY IF EXISTS vetdesk_clinic_assets_read ON storage.objects;
DROP POLICY IF EXISTS vetdesk_clinic_assets_insert ON storage.objects;
DROP POLICY IF EXISTS vetdesk_clinic_assets_update ON storage.objects;
DROP POLICY IF EXISTS vetdesk_clinic_assets_delete ON storage.objects;

CREATE POLICY vetdesk_pet_photos_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pet-photos' AND public.can_access_pet_photo(name));
CREATE POLICY vetdesk_pet_photos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pet-photos'
    AND public.can_access_pet_photo(name)
    AND lower(COALESCE(metadata->>'mimetype', '')) IN (
      'image/jpeg', 'image/png', 'image/webp'
    )
  );
CREATE POLICY vetdesk_pet_photos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'pet-photos' AND public.can_access_pet_photo(name))
  WITH CHECK (
    bucket_id = 'pet-photos'
    AND public.can_access_pet_photo(name)
    AND lower(COALESCE(metadata->>'mimetype', '')) IN (
      'image/jpeg', 'image/png', 'image/webp'
    )
  );
CREATE POLICY vetdesk_pet_photos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pet-photos' AND public.can_access_pet_photo(name));

CREATE POLICY vetdesk_clinic_assets_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'clinic-assets'
    AND substring(name FROM '^clinics/([0-9]+)/')::bigint = public.current_staff_clinic_id()
  );
CREATE POLICY vetdesk_clinic_assets_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'clinic-assets'
    AND public.can_access_clinic_asset(name)
    AND lower(COALESCE(metadata->>'mimetype', '')) IN (
      'image/jpeg', 'image/png', 'image/webp'
    )
  );
CREATE POLICY vetdesk_clinic_assets_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'clinic-assets' AND public.can_access_clinic_asset(name))
  WITH CHECK (
    bucket_id = 'clinic-assets'
    AND public.can_access_clinic_asset(name)
    AND lower(COALESCE(metadata->>'mimetype', '')) IN (
      'image/jpeg', 'image/png', 'image/webp'
    )
  );
CREATE POLICY vetdesk_clinic_assets_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'clinic-assets' AND public.can_access_clinic_asset(name));

UPDATE storage.buckets
SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id IN ('pet-photos', 'clinic-assets');

UPDATE public.pets
SET photo_url = substring(photo_url FROM '/storage/v1/object/public/pet-photos/(.+)$')
WHERE photo_url LIKE '%/storage/v1/object/public/pet-photos/%';

UPDATE public.visit_photos
SET photo_url = substring(photo_url FROM '/storage/v1/object/public/pet-photos/(.+)$')
WHERE photo_url LIKE '%/storage/v1/object/public/pet-photos/%';

UPDATE storage.buckets SET public = false WHERE id = 'pet-photos';
