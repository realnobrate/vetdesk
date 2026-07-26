import { supabase } from "./supabase";
import { addMonths as addMonthsDateFns } from "date-fns";
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
} from "./types";

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
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("staff")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return existing as Staff;

  // JIT provision: first staff member creates a clinic and becomes admin
  const { count } = await supabase
    .from("staff")
    .select("*", { count: "exact", head: true });

  const isFirst = (count ?? 0) === 0;
  const name =
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Staff Member";

  let clinicId: number;

  if (isFirst) {
    const { data: clinic, error: cErr } = await supabase
      .from("clinics")
      .insert({ name: `${name}'s Clinic` })
      .select()
      .single();
    if (cErr || !clinic) throw new Error("Failed to create clinic");
    clinicId = clinic.id;
  } else {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!clinic) throw new Error("No clinic found");
    clinicId = clinic.id;
  }

  const { data: created, error } = await supabase
    .from("staff")
    .insert({
      user_id: user.id,
      clinic_id: clinicId,
      name,
      email: user.email ?? "",
      role: isFirst ? "admin" : "front_desk",
    })
    .select()
    .single();

  if (error || !created) throw new Error("Failed to create staff record");
  return created as Staff;
}

export async function listStaff(clinicId: number): Promise<Staff[]> {
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as Staff[];
}

export async function updateStaff(
  id: number,
  update: { name?: string; role?: string }
): Promise<Staff> {
  const { data, error } = await supabase
    .from("staff")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Staff;
}

// ─── Owners ───────────────────────────────────────────────────────────────────

export async function listOwners(search?: string): Promise<Owner[]> {
  let q = supabase
    .from("owners")
    .select("*")
    .order("last_name")
    .order("first_name");

  if (search) {
    q = q.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Owner[];
}

export async function listOwnersWithPets(): Promise<OwnerWithPets[]> {
  const { data: owners, error } = await supabase
    .from("owners")
    .select("*")
    .order("last_name")
    .order("first_name");

  if (error) throw error;

  const ownersWithPets = await Promise.all(
    (owners ?? []).map(async (owner) => {
      const { data: pets } = await supabase
        .from("pets")
        .select("*")
        .eq("owner_id", owner.id)
        .order("name");

      return { ...(owner as Owner), pets: (pets ?? []) as Pet[] };
    })
  );

  return ownersWithPets;
}

export async function createOwner(
  input: Omit<Owner, "id" | "clinic_id" | "created_at">
): Promise<Owner> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("User is not authenticated");

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("clinic_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (staffError) throw staffError;

  if (!staff?.clinic_id) {
    throw new Error(
      "Your account is not connected to a clinic. Check the user_id in the staff table."
    );
  }

  const { data, error } = await supabase
    .from("owners")
    .insert({
      ...input,
      clinic_id: staff.clinic_id,
    })
    .select()
    .single();

  if (error) throw error;

  return data as Owner;
}

export async function getOwner(id: number): Promise<OwnerWithPets> {
  const { data: owner, error } = await supabase
    .from("owners")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: pets } = await supabase
    .from("pets")
    .select("*")
    .eq("owner_id", id)
    .order("name");

  return { ...(owner as Owner), pets: (pets ?? []) as Pet[] };
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
  const { error } = await supabase.from("owners").delete().eq("id", id);
  if (error) throw error;
}

// ─── Pets ─────────────────────────────────────────────────────────────────────

export async function listPets(
  opts?: { ownerId?: number; search?: string }
): Promise<Pet[]> {
  let q = supabase
    .from("pets")
    .select("*")
    .order("name");

  if (opts?.ownerId) q = q.eq("owner_id", opts.ownerId);
  if (opts?.search) q = q.ilike("name", `%${opts.search}%`);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Pet[];
}

export async function createPet(
  input: Omit<Pet, "id" | "created_at">
): Promise<Pet> {
  const { data, error } = await supabase
    .from("pets")
    .insert(input)
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
    .single();
  if (error) throw error;

  const { data: owner } = await supabase
    .from("owners")
    .select("*")
    .eq("id", (pet as Pet).owner_id)
    .single();

  const { data: visits } = await supabase
    .from("visits")
    .select("*")
    .eq("pet_id", id)
    .order("visit_date");

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

  const { data: recalls } = await supabase
    .from("recalls")
    .select("*")
    .eq("pet_id", id)
    .order("due_date");

  return {
    ...(pet as Pet),
    owner: owner as Owner,
    visits: ((visits ?? []) as Visit[]).map((visit) => ({
  ...visit,
  photos: visitPhotos.filter((photo) => photo.visit_id === visit.id),
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
  const { error } = await supabase.from("pets").delete().eq("id", id);
  if (error) throw error;
}

// ─── Visits ───────────────────────────────────────────────────────────────────

export async function createVisit(
  petId: number,
  input: Omit<Visit, "id" | "pet_id" | "created_at">
): Promise<Visit> {
  const { data, error } = await supabase
    .from("visits")
    .insert({ ...input, pet_id: petId })
    .select()
    .single();
  if (error) throw error;

  const visit = data as Visit;

  // Auto-schedule recalls for known vaccines
  const visitDateStr = visit.visit_date.slice(0, 10);
  for (const vaccine of visit.vaccines_administered) {
    const months = resolveRecallMonths(vaccine);
    if (months === null) continue;
    await supabase.from("recalls").insert({
      pet_id: petId,
      visit_id: visit.id,
      recall_type: vaccine,
      due_date: addMonths(visitDateStr, months),
      status: "upcoming",
    });
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
      await supabase
        .from("recalls")
        .update({ status: next })
        .eq("id", recall.id);
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

  return (data ?? []).map((row: any) => {
    const { pets, ...recall } = row;
    const { owners, ...pet } = pets;
    return { ...recall, pet, owner: owners } as RecallWithPet;
  });
}

export async function createRecall(
  input: Omit<Recall, "id" | "created_at" | "sent_at" | "completed_at">
): Promise<Recall> {
  const { data, error } = await supabase
    .from("recalls")
    .insert(input)
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

  return (data ?? []).map((row: any) => {
    const { pets, ...appt } = row;
    const { owners, ...pet } = pets;
    return { ...appt, pet, owner: owners } as AppointmentWithPet;
  });
}

export async function createAppointment(
  input: Omit<Appointment, "id" | "status" | "created_at">
): Promise<Appointment> {
  const { data, error } = await supabase
    .from("appointments")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Appointment;
}

export async function updateAppointment(
  id: number,
  update: Partial<Omit<Appointment, "id" | "pet_id" | "created_at">>
): Promise<Appointment> {
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

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

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
        .select("id", { count: "exact", head: true }),

      supabase
        .from("pets")
        .select("id", { count: "exact", head: true }),
    ]);

  const mapAppt = (row: any): AppointmentWithPet => {
    const { pets, ...appt } = row;
    const { owners, ...pet } = pets;
    return { ...appt, pet, owner: owners };
  };

  const mapRecall = (row: any): any => {
    const { pets, ...recall } = row;
    const { owners, ...pet } = pets;
    return { ...recall, pet, owner: owners };
  };

  const dueCount = (dueRes.data ?? []).length;
  const upcomingCount = (upcomingRes.data ?? []).length;

  return {
    todayAppointments: (apptRes.data ?? []).map(mapAppt),
    overdueRecalls: (overdueRes.data ?? []).map(mapRecall),
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
export async function getClinicStaff(clinicId: number): Promise<Staff[]> {
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: true })

  if (error) throw error

  return (data ?? []) as Staff[]
}

export async function updateStaffMember(
  staffId: number,
  updates: {
    name?: string
    role?: string
    status?: "active" | "inactive"
  }
): Promise<Staff> {
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
  role: string
}): Promise<Staff> {
  try {
    console.log("Calling add_pending_staff:", input)

    const response = await supabase.rpc("add_pending_staff", {
      staff_name: input.name,
      staff_email: input.email,
      staff_role: input.role,
    })

    console.log("FULL RPC RESPONSE:", response)

    const { data, error } = response

    if (error) {
      const detailedMessage = [
        error.message,
        error.details,
        error.hint,
        error.code,
      ]
        .filter(Boolean)
        .join(" | ")

      console.error("SUPABASE RPC ERROR:", error)

      throw new Error(detailedMessage || JSON.stringify(error))
    }

    if (!data) {
      throw new Error("Supabase returned no staff member data.")
    }

    return data as Staff
  } catch (error) {
    console.error("ADD STAFF FUNCTION ERROR:", error)

    if (error instanceof Error) {
      alert(`API error: ${error.message}`)
      throw error
    }

    alert(`API error: ${JSON.stringify(error)}`)
    throw new Error(JSON.stringify(error))
  }
}
