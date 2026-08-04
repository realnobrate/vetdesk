import { supabase } from "./supabase";
import {
  addDays as addDaysDateFns,
  addMonths as addMonthsDateFns,
  startOfDay as startOfDayDateFns,
} from "date-fns";
import type {
  Staff,
  Owner,
  Pet,
  Visit,
  Recall,
  Appointment,
  OwnerWithPets,
  PetDetail,
  AppointmentWithPet,
  RecallWithPet,
  DashboardSummary,
  VisitPhoto,
  Clinic,
  EmailStatistics,
  StaffRole,
  CreateVisitInput,
  Vaccination,
  Prescription,
  LabOrder,
  LabOrderStatus,
  ClinicalDocument,
  ClinicalRecordData,
  MedicalNoteTemplate,
} from "./types";

interface OwnerWithPetsRow extends Owner {
  pets: Pet[] | null;
}

interface AppointmentJoinRow extends Appointment {
  pets: Pet & { owners: Owner };
}

interface RecallJoinRow extends Recall {
  pets: Pet & { owners: Owner };
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function sanitizeSearchTerm(value: string): string {
  return value.trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ");
}

async function signPetPhotoPaths(
  values: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const paths = [...new Set(values.filter(
    (value): value is string => Boolean(value) && !/^https?:\/\//i.test(value as string),
  ))];
  if (paths.length === 0) return new Map();

  const { data, error } = await supabase.storage
    .from("pet-photos")
    .createSignedUrls(paths, 60 * 60);
  if (error) throw error;

  const entries: Array<[string, string]> = [];
  for (const item of data ?? []) {
    if (typeof item.path === "string" && typeof item.signedUrl === "string") {
      entries.push([item.path, item.signedUrl]);
    }
  }
  return new Map(entries);
}

function resolvePhotoUrl(
  value: string | null | undefined,
  signedUrls: Map<string, string>,
): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return signedUrls.get(value) ?? null;
}

// ─── Recall status refresh ────────────────────────────────────────────────────

const RECALL_RULES: Record<string, number> = {
  rabies: 12,
  dhpp: 12,
  "dhpp booster": 12,
  bordetella: 6,
  "feline distemper": 12,
  fvrcp: 12,
  leptospirosis: 12,
  "lyme vaccine": 12,
  "canine influenza": 12,
  dental: 12,
  "heartworm test": 12,
  "flea/tick prevention": 1,
};

function resolveRecallMonths(name: string): number | null {
  return RECALL_RULES[name.trim().toLowerCase()] ?? null;
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  const result = addMonthsDateFns(d, months);
  return result.toISOString().slice(0, 10);
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export async function getOrCreateStaff(): Promise<Staff> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: existing, error: existingError } = await supabase
    .from("staff")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing as Staff;
  }

  const { data, error } = await supabase
    .rpc("provision_vetdesk_clinic")
    .single();

  if (error || !data) {
    console.error("Provision clinic error:", error);
    throw new Error(
      error?.message || "Failed to create clinic account"
    );
  }

  return data as Staff;
}

async function requireCurrentStaff(): Promise<Staff> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("User is not authenticated");

  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  if (!data?.clinic_id) {
    throw new Error("Your active staff account is not connected to a clinic.");
  }

  return data as Staff;
}

async function requireCurrentClinicId(): Promise<number> {
  const staff = await requireCurrentStaff();
  return staff.clinic_id as number;
}

// ─── Owners ───────────────────────────────────────────────────────────────────

export async function listOwners(search?: string): Promise<Owner[]> {
  let q = supabase
    .from("owners")
    .select("*")
    .is("deleted_at", null)
    .order("last_name")
    .order("first_name");

  if (search) {
    const safeSearch = sanitizeSearchTerm(search);
    if (!safeSearch) return [];
    q = q.or(
      `first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`
    );
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Owner[];
}

export async function listOwnersWithPets(): Promise<OwnerWithPets[]> {
  const { data, error } = await supabase
    .from("owners")
    .select("*, pets(*)")
    .is("deleted_at", null)
    .order("last_name")
    .order("first_name");

  if (error) throw error;

  return ((data ?? []) as OwnerWithPetsRow[]).map((row) => ({
    ...row,
    pets: [...(row.pets ?? [])]
      .filter((pet) => !pet.deleted_at)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

export async function createOwner(
  input: Omit<
    Owner,
    "id" | "clinic_id" | "created_at" | "deleted_at" | "deleted_by"
  >
): Promise<Owner> {
  const clinicId = await requireCurrentClinicId();

  const { data, error } = await supabase
    .from("owners")
    .insert({
      ...input,
      clinic_id: clinicId,
    })
    .select()
    .single();

  if (error) throw error;

  return data as Owner;
}

export async function getOwner(id: number): Promise<OwnerWithPets> {
  const { data, error } = await supabase
    .from("owners")
    .select("*, pets(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) throw error;

  const row = data as OwnerWithPetsRow;
  return {
    ...row,
    pets: [...(row.pets ?? [])]
      .filter((pet) => !pet.deleted_at)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function updateOwner(
  id: number,
  update: Partial<Omit<Owner, "id" | "clinic_id" | "created_at">>
): Promise<Owner> {
  const { data, error } = await supabase
    .from("owners")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Owner;
}

export async function deleteOwner(id: number): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_owner", {
    target_owner_id: id,
  });
  if (error) throw error;
}

// ─── Pets ─────────────────────────────────────────────────────────────────────

export async function listPets(
  opts?: { ownerId?: number; search?: string }
): Promise<Pet[]> {
  let q = supabase
    .from("pets")
    .select("*")
    .is("deleted_at", null)
    .order("name");

  if (opts?.ownerId) q = q.eq("owner_id", opts.ownerId);
  if (opts?.search) q = q.ilike("name", `%${opts.search}%`);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Pet[];
}

export async function createPet(
  input: Pick<Pet, "owner_id" | "name" | "species"> &
    Partial<
      Pick<
        Pet,
        | "breed"
        | "sex"
        | "birth_date"
        | "weight_lb"
        | "notes"
        | "photo_url"
        | "microchip_number"
        | "allergies"
        | "chronic_conditions"
        | "important_warnings"
        | "insurance_provider"
        | "insurance_policy_number"
        | "reproductive_status"
        | "is_deceased"
        | "deceased_on"
        | "cause_of_death"
      >
    >
): Promise<Pet> {
  const clinicId = await requireCurrentClinicId();
  const { data, error } = await supabase
    .from("pets")
    .insert({ ...input, clinic_id: clinicId })
    .select()
    .single();
  if (error) throw error;
  return data as Pet;
}

export async function getPet(id: number): Promise<PetDetail> {
  const { data: pet, error } = await supabase
    .from("pets")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) throw error;

  const { data: owner, error: ownerError } = await supabase
    .from("owners")
    .select("*")
    .eq("id", (pet as Pet).owner_id)
    .is("deleted_at", null)
    .single();
  if (ownerError) throw ownerError;

  const { data: visits, error: visitsError } = await supabase
    .from("visits")
    .select("*")
    .eq("pet_id", id)
    .order("visit_date");
  if (visitsError) throw visitsError;

    const visitIds = (visits ?? []).map((visit) => visit.id)

let visitPhotos: VisitPhoto[] = []

if (visitIds.length > 0) {
  const { data: photos, error: photosError } = await supabase
    .from("visit_photos")
    .select("*")
    .in("visit_id", visitIds)
    .order("created_at", { ascending: true })

  if (photosError) throw photosError

  visitPhotos = (photos ?? []) as VisitPhoto[]
}

  const { data: recalls, error: recallsError } = await supabase
    .from("recalls")
    .select("*")
    .eq("pet_id", id)
    .order("due_date");
  if (recallsError) throw recallsError;

  const petRecord = pet as Pet;
  const signedUrls = await signPetPhotoPaths([
    petRecord.photo_url,
    ...visitPhotos.map((photo) => photo.photo_url),
  ]);

  return {
    ...petRecord,
    photo_url: resolvePhotoUrl(petRecord.photo_url, signedUrls),
    owner: owner as Owner,
    visits: ((visits ?? []) as Visit[]).map((visit) => ({
  ...visit,
  photos: visitPhotos
    .filter((photo) => photo.visit_id === visit.id)
    .map((photo) => ({
      ...photo,
      photo_url: resolvePhotoUrl(photo.photo_url, signedUrls) ?? "",
    })),
})),
    recalls: (recalls ?? []) as Recall[],
  };
}

export async function updatePet(
  id: number,
  update: Partial<Omit<Pet, "id" | "owner_id" | "created_at">>
): Promise<Pet> {
  const { data, error } = await supabase
    .from("pets")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Pet;
}

export async function deletePet(id: number): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_pet", {
    target_pet_id: id,
  });
  if (error) throw error;
}

// ─── Visits ───────────────────────────────────────────────────────────────────

export async function createVisit(
  petId: number,
  input: CreateVisitInput,
): Promise<Visit> {
  const clinicId = await requireCurrentClinicId();
  const { data, error } = await supabase
    .from("visits")
    .insert({
      ...input,
      clinic_id: clinicId,
      pet_id: petId,
      finalized_at:
        input.record_status === "draft"
          ? null
          : input.finalized_at ?? new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;

  const visit = data as Visit;

  // Auto-schedule recalls for known vaccines
  const visitDateStr = visit.visit_date.slice(0, 10);
  for (const vaccine of visit.vaccines_administered) {
    const months = resolveRecallMonths(vaccine);
    if (months === null) continue;
    const { error: recallError } = await supabase.from("recalls").insert({
      pet_id: petId,
      clinic_id: clinicId,
      visit_id: visit.id,
      recall_type: vaccine,
      due_date: addMonths(visitDateStr, months),
      status: "upcoming",
    });
    if (recallError) throw recallError;
  }

  return visit;
}

export async function updateVisit(
  id: number,
  update: Partial<Omit<Visit, "id" | "pet_id" | "created_at">>
): Promise<Visit> {
  const { data, error } = await supabase
    .from("visits")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Visit;
}

export async function deleteVisit(id: number): Promise<void> {
  const { error } = await supabase.from("visits").delete().eq("id", id);
  if (error) throw error;
}

// ─── Clinical record ──────────────────────────────────────────────────────────

async function requireClinicalStaff(): Promise<Staff> {
  const staff = await requireCurrentStaff();
  if (staff.role !== "admin" && staff.role !== "veterinarian") {
    throw new Error("Only veterinarians and clinic administrators can change clinical records.");
  }
  return staff;
}

export async function getClinicalRecord(
  petId: number,
): Promise<ClinicalRecordData> {
  const pet = await getPet(petId);

  const [vaccinationsResult, prescriptionsResult, labsResult, documentsResult, templatesResult] =
    await Promise.all([
      supabase
        .from("vaccinations")
        .select("*")
        .eq("pet_id", petId)
        .is("deleted_at", null)
        .order("administered_on", { ascending: false }),
      supabase
        .from("prescriptions")
        .select("*")
        .eq("pet_id", petId)
        .is("deleted_at", null)
        .order("starts_on", { ascending: false }),
      supabase
        .from("lab_orders")
        .select("*")
        .eq("pet_id", petId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("clinical_documents")
        .select("*")
        .eq("pet_id", petId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("medical_note_templates")
        .select("*")
        .eq("clinic_id", pet.clinic_id)
        .is("archived_at", null)
        .order("name"),
    ]);

  const firstError = [
    vaccinationsResult.error,
    prescriptionsResult.error,
    labsResult.error,
    documentsResult.error,
    templatesResult.error,
  ].find(Boolean);
  if (firstError) throw firstError;

  const documentRows = (documentsResult.data ?? []) as Omit<
    ClinicalDocument,
    "signed_url"
  >[];
  const paths = documentRows.map((document) => document.storage_path);
  const signedDocumentUrls = new Map<string, string>();

  if (paths.length > 0) {
    const { data: signed, error: signedError } = await supabase.storage
      .from("medical-documents")
      .createSignedUrls(paths, 60 * 60);
    if (signedError) throw signedError;
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) {
        signedDocumentUrls.set(item.path, item.signedUrl);
      }
    }
  }

  return {
    pet,
    vaccinations: (vaccinationsResult.data ?? []) as Vaccination[],
    prescriptions: (prescriptionsResult.data ?? []) as Prescription[],
    labOrders: (labsResult.data ?? []) as LabOrder[],
    documents: documentRows.map((document) => ({
      ...document,
      signed_url: signedDocumentUrls.get(document.storage_path) ?? null,
    })),
    noteTemplates: (templatesResult.data ?? []) as MedicalNoteTemplate[],
  };
}

export async function createVaccination(
  petId: number,
  input: {
    visit_id?: number | null;
    vaccine_name: string;
    manufacturer?: string | null;
    lot_number?: string | null;
    expires_on?: string | null;
    administered_on: string;
    administration_site?: string | null;
    next_due_date?: string | null;
    notes?: string | null;
  },
): Promise<Vaccination> {
  const staff = await requireClinicalStaff();
  const { data, error } = await supabase
    .from("vaccinations")
    .insert({
      ...input,
      clinic_id: staff.clinic_id,
      pet_id: petId,
      veterinarian_staff_id: staff.id,
      created_by: staff.user_id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Vaccination;
}

export async function createPrescription(
  petId: number,
  input: {
    visit_id?: number | null;
    medication_name: string;
    dosage: string;
    frequency: string;
    duration?: string | null;
    route?: string | null;
    instructions: string;
    starts_on: string;
    ends_on?: string | null;
    refills_allowed?: number;
    medication_warnings?: string | null;
  },
): Promise<Prescription> {
  const staff = await requireClinicalStaff();
  const refills = input.refills_allowed ?? 0;
  const { data, error } = await supabase
    .from("prescriptions")
    .insert({
      ...input,
      clinic_id: staff.clinic_id,
      pet_id: petId,
      prescriber_staff_id: staff.id,
      created_by: staff.user_id,
      refills_allowed: refills,
      refills_remaining: refills,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Prescription;
}

export async function updatePrescriptionStatus(
  prescriptionId: number,
  status: "active" | "completed" | "discontinued",
): Promise<Prescription> {
  await requireClinicalStaff();
  const { data, error } = await supabase
    .from("prescriptions")
    .update({
      status,
      discontinued_at: status === "discontinued" ? new Date().toISOString() : null,
    })
    .eq("id", prescriptionId)
    .select()
    .single();
  if (error) throw error;
  return data as Prescription;
}

export async function createLabOrder(
  petId: number,
  input: {
    visit_id?: number | null;
    test_name: string;
    category: string;
    laboratory_type: "internal" | "external";
    laboratory_name?: string | null;
    sample_type?: string | null;
    notes?: string | null;
  },
): Promise<LabOrder> {
  const staff = await requireClinicalStaff();
  const { data, error } = await supabase
    .from("lab_orders")
    .insert({
      ...input,
      clinic_id: staff.clinic_id,
      pet_id: petId,
      ordered_by_staff_id: staff.id,
      created_by: staff.user_id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as LabOrder;
}

export async function updateLabOrder(
  labOrderId: number,
  update: {
    status?: LabOrderStatus;
    sample_collected_at?: string | null;
    result_text?: string | null;
    result_numeric?: number | null;
    result_unit?: string | null;
    reference_range?: string | null;
    is_abnormal?: boolean;
    reviewed?: boolean;
    owner_notified?: boolean;
    notes?: string | null;
  },
): Promise<LabOrder> {
  const staff = await requireClinicalStaff();
  const { reviewed, owner_notified: ownerNotified, ...values } = update;
  const databaseUpdate: Record<string, unknown> = { ...values };
  if (reviewed !== undefined) {
    databaseUpdate.reviewed_at = reviewed ? new Date().toISOString() : null;
    databaseUpdate.reviewed_by_staff_id = reviewed ? staff.id : null;
  }
  if (ownerNotified !== undefined) {
    databaseUpdate.owner_notified_at = ownerNotified
      ? new Date().toISOString()
      : null;
  }

  const { data, error } = await supabase
    .from("lab_orders")
    .update(databaseUpdate)
    .eq("id", labOrderId)
    .select()
    .single();
  if (error) throw error;
  return data as LabOrder;
}

export async function createMedicalNoteTemplate(input: {
  name: string;
  presenting_complaint?: string | null;
  subjective_notes?: string | null;
  objective_notes?: string | null;
  assessment?: string | null;
  treatment_plan?: string | null;
  follow_up_recommendations?: string | null;
}): Promise<MedicalNoteTemplate> {
  const staff = await requireClinicalStaff();
  const { data, error } = await supabase
    .from("medical_note_templates")
    .insert({
      ...input,
      clinic_id: staff.clinic_id,
      created_by: staff.user_id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MedicalNoteTemplate;
}

const CLINICAL_DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadClinicalDocument(
  petId: number,
  file: File,
  input: {
    document_type: string;
    visit_id?: number | null;
    lab_order_id?: number | null;
    client_visible?: boolean;
  },
): Promise<ClinicalDocument> {
  const staff = await requireClinicalStaff();
  const extension = CLINICAL_DOCUMENT_TYPES[file.type];
  if (!extension) {
    throw new Error("Only PDF, JPG, PNG, and WEBP clinical documents are allowed.");
  }
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("Clinical documents must be smaller than 10 MB.");
  }

  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "document";
  const storagePath = `clinics/${staff.clinic_id}/pets/${petId}/${crypto.randomUUID()}-${safeName}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("medical-documents")
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("clinical_documents")
    .insert({
      ...input,
      clinic_id: staff.clinic_id,
      pet_id: petId,
      display_name: file.name.slice(0, 255),
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: staff.user_id,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from("medical-documents").remove([storagePath]);
    throw error;
  }

  const { data: signed } = await supabase.storage
    .from("medical-documents")
    .createSignedUrl(storagePath, 60 * 60);

  return {
    ...(data as Omit<ClinicalDocument, "signed_url">),
    signed_url: signed?.signedUrl ?? null,
  };
}

// ─── Recalls ──────────────────────────────────────────────────────────────────

async function refreshRecallStatuses(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const dueSoon = new Date();
  dueSoon.setUTCDate(dueSoon.getUTCDate() + 14);
  const dueSoonStr = dueSoon.toISOString().slice(0, 10);

  const { data: open } = await supabase
    .from("recalls")
    .select("id, due_date, status, pet_id")
    .in("status", ["upcoming", "due", "overdue"]);

  if (!open) return;

  for (const recall of open) {
    let next: "upcoming" | "due" | "overdue" = "upcoming";
    if (recall.due_date < today) next = "overdue";
    else if (recall.due_date <= dueSoonStr) next = "due";

    if (next !== recall.status) {
      const { error } = await supabase
        .from("recalls")
        .update({ status: next })
        .eq("id", recall.id);
      if (error) throw error;
    }
  }
}

export async function listRecalls(
  opts?: { status?: string; dueBefore?: string }
): Promise<RecallWithPet[]> {
  await refreshRecallStatuses();

  let q = supabase
    .from("recalls")
    .select("*, pets(*, owners(*))")
    .order("due_date");

  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.dueBefore) q = q.lte("due_date", opts.dueBefore);

  const { data, error } = await q;
  if (error) throw error;

  return ((data ?? []) as RecallJoinRow[]).map((row) => {
    const { pets, ...recall } = row;
    const { owners, ...pet } = pets;
    return { ...recall, pet, owner: owners } as RecallWithPet;
  });
}

export async function createRecall(
  input: Omit<
    Recall,
    "id" | "clinic_id" | "created_at" | "sent_at" | "completed_at"
  >
): Promise<Recall> {
  const clinicId = await requireCurrentClinicId();
  const { data, error } = await supabase
    .from("recalls")
    .insert({ ...input, clinic_id: clinicId })
    .select()
    .single();
  if (error) throw error;

  return data as Recall;
}

export async function updateRecall(
  id: number,
  update: Partial<
    Omit<Recall, "id" | "pet_id" | "visit_id" | "created_at">
  >
): Promise<Recall> {
  // Fetch existing recall first
  const { data: existing, error: existingError } = await supabase
    .from("recalls")
    .select("*")
    .eq("id", id)
    .single();
  
  if (existingError) throw existingError;
  if (!existing) throw new Error("Recall not found");
  
  const patch: Record<string, unknown> = { ...update };
  if (update.status === "sent") patch.sent_at = new Date().toISOString();
  if (update.status === "completed")
    patch.completed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("recalls")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  

  return data as Recall;
}

export async function deleteRecall(id: number): Promise<void> {
  const { error } = await supabase.from("recalls").delete().eq("id", id);
  if (error) throw error;
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export async function listAppointments(
  dateStr?: string
): Promise<AppointmentWithPet[]> {
  let q = supabase
    .from("appointments")
    .select("*, pets(*, owners(*))")
    .order("scheduled_at");

  if (dateStr) {
    const start = new Date(`${dateStr}T00:00:00`);
    const end = new Date(`${dateStr}T00:00:00`);
    end.setDate(end.getDate() + 1);
    q = q
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString());
  }

  const { data, error } = await q;
  if (error) throw error;

  return ((data ?? []) as AppointmentJoinRow[]).map((row) => {
    const { pets, ...appt } = row;
    const { owners, ...pet } = pets;
    return { ...appt, pet, owner: owners } as AppointmentWithPet;
  });
}

export async function createAppointment(
  input: Omit<Appointment, "id" | "clinic_id" | "status" | "created_at">
): Promise<Appointment> {
  const clinicId = await requireCurrentClinicId();
  const { data, error } = await supabase
    .from("appointments")
    .insert({ ...input, clinic_id: clinicId, status: "scheduled" })
    .select()
    .single();
  if (error) throw error;

  return data as Appointment;
}

export async function updateAppointment(
  id: number,
  update: Partial<Omit<Appointment, "id" | "pet_id" | "created_at">>
): Promise<Appointment> {
  // Fetch existing appointment first
  const { data: existing, error: existingError } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .single();
  
  if (existingError) throw existingError;
  if (!existing) throw new Error("Appointment not found");
  
  const { data, error } = await supabase
    .from("appointments")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  

  return data as Appointment;
}

export async function deleteAppointment(id: number): Promise<void> {
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) throw error;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<DashboardSummary> {
  await refreshRecallStatuses();

  const startOfDay = startOfDayDateFns(new Date());
  const endOfDay = addDaysDateFns(startOfDay, 1);

  const [apptRes, overdueRes, dueRes, upcomingRes, visitsRes, ownersCountRes, petsCountRes] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("*, pets(*, owners(*))")
        .gte("scheduled_at", startOfDay.toISOString())
        .lt("scheduled_at", endOfDay.toISOString())
        .order("scheduled_at"),

      supabase
        .from("recalls")
        .select("*, pets(*, owners(*))")
        .eq("status", "overdue")
        .order("due_date"),

      supabase
        .from("recalls")
        .select("id")
        .eq("status", "due"),

      supabase
        .from("recalls")
        .select("id")
        .eq("status", "upcoming"),

      supabase
        .from("visits")
        .select("*")
        .order("visit_date", { ascending: false })
        .limit(10),

      supabase
        .from("owners")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),

      supabase
        .from("pets")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
    ]);

  const mapAppt = (row: AppointmentJoinRow): AppointmentWithPet => {
    const { pets, ...appt } = row;
    const { owners, ...pet } = pets;
    return { ...appt, pet, owner: owners };
  };

  const mapRecall = (row: RecallJoinRow): RecallWithPet => {
    const { pets, ...recall } = row;
    const { owners, ...pet } = pets;
    return { ...recall, pet, owner: owners };
  };

  const dueCount = (dueRes.data ?? []).length;
  const upcomingCount = (upcomingRes.data ?? []).length;

  return {
    todayAppointments: ((apptRes.data ?? []) as AppointmentJoinRow[]).map(mapAppt),
    overdueRecalls: ((overdueRes.data ?? []) as RecallJoinRow[]).map(mapRecall),
    upcomingRecallsCount: dueCount + upcomingCount,
    recentVisits: (visitsRes.data ?? []) as Visit[],
    totalOwners: ownersCountRes.count ?? 0,
    totalPets: petsCountRes.count ?? 0,
  };
}
export async function getVisitPhotos(
  visitId: number
): Promise<VisitPhoto[]> {
  const { data, error } = await supabase
    .from("visit_photos")
    .select("*")
    .eq("visit_id", visitId)
    .order("created_at", { ascending: true })

  if (error) throw error

  return (data ?? []) as VisitPhoto[]
}

export async function createVisitPhoto(data: {
  visit_id: number
  photo_url: string
  caption?: string | null
}): Promise<VisitPhoto> {
  const { data: createdPhoto, error } = await supabase
    .from("visit_photos")
    .insert({
      visit_id: data.visit_id,
      photo_url: data.photo_url,
      caption: data.caption || null,
    })
    .select()
    .single()

  if (error) throw error

  return createdPhoto as VisitPhoto
}

export async function deleteVisitPhoto(id: number): Promise<void> {
  const { error } = await supabase
    .from("visit_photos")
    .delete()
    .eq("id", id)

  if (error) throw error
}
export async function getClinic(clinicId: number): Promise<Clinic> {
  const { data, error } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", clinicId)
    .single()

  if (error) throw error

  return data as Clinic
}

export async function updateClinic(
  clinicId: number,
  updates: Partial<
    Omit<Clinic, "id" | "created_at">
  >
): Promise<Clinic> {
  const { data, error } = await supabase
    .from("clinics")
    .update(updates)
    .eq("id", clinicId)
    .select()
    .single()

  if (error) throw error

  return data as Clinic
}

export async function getClinicExportData(clinicId: number) {
  // Fetch clinic
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", clinicId)
    .single();

  if (clinicError) throw clinicError;

  // Fetch all owners for this clinic
  const { data: owners, error: ownersError } = await supabase
    .from("owners")
    .select("*")
    .eq("clinic_id", clinicId)
    .is("deleted_at", null);

  if (ownersError) throw ownersError;

  // Fetch all pets for owners in this clinic
  const ownerIds = (owners || []).map(o => o.id);
  const petsResult = ownerIds.length
    ? await supabase.from("pets").select("*").in("owner_id", ownerIds).is("deleted_at", null)
    : { data: [] as Pet[], error: null };
  const { data: pets, error: petsError } = petsResult;

  if (petsError) throw petsError;

  // Fetch all appointments for pets in this clinic
  const petIds = (pets || []).map(p => p.id);
  const appointmentsResult = petIds.length
    ? await supabase.from("appointments").select("*").in("pet_id", petIds)
    : { data: [] as Appointment[], error: null };
  const { data: appointments, error: appointmentsError } = appointmentsResult;

  if (appointmentsError) throw appointmentsError;

  // Fetch all visits for pets in this clinic
  const visitsResult = petIds.length
    ? await supabase.from("visits").select("*").in("pet_id", petIds)
    : { data: [] as Visit[], error: null };
  const { data: visits, error: visitsError } = visitsResult;

  if (visitsError) throw visitsError;

  // Fetch all recalls for pets in this clinic
  const recallsResult = petIds.length
    ? await supabase.from("recalls").select("*").in("pet_id", petIds)
    : { data: [] as Recall[], error: null };
  const { data: recalls, error: recallsError } = recallsResult;

  if (recallsError) throw recallsError;

  // Fetch all staff for this clinic
  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("*")
    .eq("clinic_id", clinicId);

  if (staffError) throw staffError;

  // Build lookup maps for relationships
  const ownerMap = new Map((owners || []).map(o => [o.id, o]));
  const petMap = new Map((pets || []).map(p => [p.id, p]));

  // Enrich data with relationship names
  const enrichedPets = (pets || []).map(pet => ({
    ...pet,
    owner_name: ownerMap.has(pet.owner_id)
      ? `${ownerMap.get(pet.owner_id)!.first_name} ${ownerMap.get(pet.owner_id)!.last_name}`
      : undefined,
  }));

  const enrichedAppointments = (appointments || []).map(appt => {
    const pet = petMap.get(appt.pet_id);
    const owner = pet ? ownerMap.get(pet.owner_id) : undefined;
    return {
      ...appt,
      pet_name: pet?.name,
      owner_name: owner ? `${owner.first_name} ${owner.last_name}` : undefined,
    };
  });

  const enrichedVisits = (visits || []).map(visit => {
    const pet = petMap.get(visit.pet_id);
    const owner = pet ? ownerMap.get(pet.owner_id) : undefined;
    return {
      ...visit,
      pet_name: pet?.name,
      owner_name: owner ? `${owner.first_name} ${owner.last_name}` : undefined,
    };
  });

  const enrichedRecalls = (recalls || []).map(recall => {
    const pet = petMap.get(recall.pet_id);
    const owner = pet ? ownerMap.get(pet.owner_id) : undefined;
    return {
      ...recall,
      pet_name: pet?.name,
      owner_name: owner ? `${owner.first_name} ${owner.last_name}` : undefined,
    };
  });

  return {
    clinic: clinic as Clinic,
    owners: owners as Owner[],
    pets: enrichedPets,
    appointments: enrichedAppointments,
    visits: enrichedVisits,
    recalls: enrichedRecalls,
    staff: staff as Staff[],
  };
}

export async function getClinicStaff(clinicId: number): Promise<Staff[]> {
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: true })

  if (error) throw error

  return (data ?? []) as Staff[]
}

// ─── Email Notifications ─────────────────────────────────────────────────────

export async function updateNotificationSettings(
  clinicId: number,
  settings: {
    appointment_reminders_enabled?: boolean
    recall_reminders_enabled?: boolean
    appointment_reminder_hours_before?: number
    recall_reminder_days_before?: number
    email_sender_name?: string
    reply_to_email?: string | null
  }
): Promise<Clinic> {
  const { data, error } = await supabase
    .from("clinics")
    .update(settings)
    .eq("id", clinicId)
    .select()
    .single()

  if (error) throw error

  return data as Clinic
}

export async function getEmailStatistics(clinicId: number): Promise<EmailStatistics> {
  const today = new Date().toISOString().split('T')[0]
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [emailsSentRes, upcomingRes, failedRes, lastSuccessRes] = await Promise.all([
    supabase
      .from("sent_emails")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("sent_at", today),
    supabase
      .from("notification_queue")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "pending")
      .gte("scheduled_for", new Date().toISOString()),
    supabase
      .from("sent_emails")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "failed")
      .gte("sent_at", twentyFourHoursAgo),
    supabase
      .from("sent_emails")
      .select("sent_at")
      .eq("clinic_id", clinicId)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return {
    emails_sent_today: emailsSentRes.count ?? 0,
    upcoming_reminders: upcomingRes.count ?? 0,
    failed_emails: failedRes.count ?? 0,
    last_successful_email: lastSuccessRes.data?.sent_at ?? null,
  }
}

export async function sendTestEmail(clinicId: number, testEmail?: string): Promise<{ success: boolean; message: string }> {
  // Validate inputs
  if (!clinicId) {
    throw new Error('Clinic ID is required')
  }

  // Block example/test email addresses
  const blockedDomains = ['test@example.com', 'clinic@example.com', 'example.com', 'test.com']
  if (testEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      throw new Error('Invalid email address format')
    }
    if (blockedDomains.some(domain => testEmail.toLowerCase().includes(domain))) {
      throw new Error('Please use a real email address, not an example address')
    }
  }

  const { data, error } = await supabase.functions.invoke('send-test-email', {
    body: { clinicId, testEmail }
  })

  if (error) {
    // Extract the actual error message from the Edge Function response
    const errorMessage = error.message || error.context?.message || JSON.stringify(error)
    throw new Error(errorMessage)
  }

  // Check if the Edge Function returned an error in the data
  if (data && !data.success) {
    throw new Error(data.error || data.message || 'Failed to send test email')
  }

  return data as { success: boolean; message: string }
}

export async function updateStaffMember(
  staffId: number,
  updates: {
    name?: string
    role?: StaffRole
    status?: "active" | "inactive"
  }
): Promise<Staff> {
  const currentStaff = await requireCurrentStaff()
  if (currentStaff.role !== "admin" || !currentStaff.clinic_id) {
    throw new Error("Only clinic administrators can update staff members.")
  }

  const { data: target, error: targetError } = await supabase
    .from("staff")
    .select("id, clinic_id, role, status")
    .eq("id", staffId)
    .single()

  if (targetError) throw targetError
  if (target.clinic_id !== currentStaff.clinic_id) {
    throw new Error("This staff member does not belong to your clinic.")
  }
  if (
    target.id === currentStaff.id &&
    (updates.role !== undefined || updates.status !== undefined)
  ) {
    throw new Error("You cannot change your own role or account status.")
  }

  if (
    target.role === "admin" &&
    (updates.role !== undefined && updates.role !== "admin" ||
      updates.status === "inactive")
  ) {
    const { count, error: countError } = await supabase
      .from("staff")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", currentStaff.clinic_id)
      .eq("role", "admin")
      .eq("status", "active")

    if (countError) throw countError
    if ((count ?? 0) <= 1) {
      throw new Error("A clinic must keep at least one active administrator.")
    }
  }

  const { data, error } = await supabase
    .from("staff")
    .update(updates)
    .eq("id", staffId)
    .select()
    .single()

  if (error) throw error

  return data as Staff
}
export async function addStaffMember(input: {
  clinic_id: number
  name: string
  email: string
  role: StaffRole
}): Promise<Staff> {
  const currentStaff = await requireCurrentStaff()
  if (currentStaff.role !== "admin" || currentStaff.clinic_id !== input.clinic_id) {
    throw new Error("Only clinic administrators can add staff members.")
  }

  const { data, error } = await supabase.rpc("admin_add_pending_staff", {
    staff_name: input.name.trim(),
    staff_email: input.email.trim().toLowerCase(),
    staff_role: input.role,
  }).single()

  if (error) {
    throw new Error(getErrorMessage(error, "Could not add the staff member."))
  }

  if (!data) {
    throw new Error("Supabase returned no staff member data.")
  }

  return data as Staff
}
