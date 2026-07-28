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
  NotificationQueue,
  SentEmail,
  EmailStatistics,
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
    .rpc("provision_my_clinic")
    .single();

  if (error || !data) {
    console.error("Provision clinic error:", error);
    throw new Error(
      error?.message || "Failed to create clinic account"
    );
  }

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
  
  const recall = data as Recall;
  
  // Schedule vaccine reminders if enabled
  try {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("recall_reminders_enabled, recall_reminder_days_before")
      .eq("id", recall.clinic_id)
      .single();
    
    if (clinic?.recall_reminders_enabled && recall.due_date) {
      const dueDate = new Date(recall.due_date);
      const daysBefore = clinic.recall_reminder_days_before || 7;
      
      // Schedule reminder X days before due date
      const reminderDateBefore = new Date(dueDate.getTime() - daysBefore * 24 * 60 * 60 * 1000);
      if (reminderDateBefore > new Date()) {
        await supabase.from("notification_queue").insert({
          clinic_id: recall.clinic_id,
          type: "vaccine_reminder",
          target_id: recall.id,
          scheduled_for: reminderDateBefore.toISOString(),
          status: "pending"
        });
      }
      
      // Schedule reminder on due date
      if (dueDate > new Date()) {
        await supabase.from("notification_queue").insert({
          clinic_id: recall.clinic_id,
          type: "vaccine_reminder",
          target_id: recall.id,
          scheduled_for: dueDate.toISOString(),
          status: "pending"
        });
      }
      
      // Schedule reminder 7 days after due date
      const overdueDate = new Date(dueDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (overdueDate > new Date()) {
        await supabase.from("notification_queue").insert({
          clinic_id: recall.clinic_id,
          type: "vaccine_reminder",
          target_id: recall.id,
          scheduled_for: overdueDate.toISOString(),
          status: "pending"
        });
      }
    }
  } catch (err) {
    console.error("Failed to schedule vaccine reminders:", err);
  }
  
  return recall;
}

export async function updateRecall(
  id: number,
  update: Partial<
    Omit<Recall, "id" | "pet_id" | "visit_id" | "created_at">
  >
): Promise<Recall> {
  // Fetch existing recall first
  const { data: existing } = await supabase
    .from("recalls")
    .select("*")
    .eq("id", id)
    .single();
  
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
  
  const recall = data as Recall;
  
  // Cancel existing pending reminders if recall is completed
  if (update.status === "completed") {
    await supabase
      .from("notification_queue")
      .update({ status: "cancelled", error_message: "Recall completed" })
      .eq("type", "vaccine_reminder")
      .eq("target_id", id)
      .eq("status", "pending");
  }
  
  // Reschedule reminders if due date changed
  if (update.due_date && existing.due_date !== update.due_date) {
    try {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("recall_reminders_enabled, recall_reminder_days_before")
        .eq("id", recall.clinic_id)
        .single();
      
      if (clinic?.recall_reminders_enabled) {
        // Cancel old pending reminders
        await supabase
          .from("notification_queue")
          .update({ status: "cancelled", error_message: "Recall rescheduled" })
          .eq("type", "vaccine_reminder")
          .eq("target_id", id)
          .eq("status", "pending");
        
        // Create new reminders
        const dueDate = new Date(recall.due_date);
        const daysBefore = clinic.recall_reminder_days_before || 7;
        
        // Schedule reminder X days before due date
        const reminderDateBefore = new Date(dueDate.getTime() - daysBefore * 24 * 60 * 60 * 1000);
        if (reminderDateBefore > new Date()) {
          await supabase.from("notification_queue").insert({
            clinic_id: recall.clinic_id,
            type: "vaccine_reminder",
            target_id: recall.id,
            scheduled_for: reminderDateBefore.toISOString(),
            status: "pending"
          });
        }
        
        // Schedule reminder on due date
        if (dueDate > new Date()) {
          await supabase.from("notification_queue").insert({
            clinic_id: recall.clinic_id,
            type: "vaccine_reminder",
            target_id: recall.id,
            scheduled_for: dueDate.toISOString(),
            status: "pending"
          });
        }
        
        // Schedule reminder 7 days after due date
        const overdueDate = new Date(dueDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (overdueDate > new Date()) {
          await supabase.from("notification_queue").insert({
            clinic_id: recall.clinic_id,
            type: "vaccine_reminder",
            target_id: recall.id,
            scheduled_for: overdueDate.toISOString(),
            status: "pending"
          });
        }
      }
    } catch (err) {
      console.error("Failed to reschedule vaccine reminders:", err);
    }
  }
  
  return recall;
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
  
  const appointment = data as Appointment;
  
  // Schedule appointment reminder if enabled
  try {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("appointment_reminders_enabled, appointment_reminder_hours_before")
      .eq("id", appointment.clinic_id)
      .single();
    
    if (clinic?.appointment_reminders_enabled && appointment.scheduled_at) {
      const scheduledDate = new Date(appointment.scheduled_at);
      const reminderDate = new Date(scheduledDate.getTime() - (clinic.appointment_reminder_hours_before || 24) * 60 * 60 * 1000);
      
      if (reminderDate > new Date()) {
        await supabase.from("notification_queue").insert({
          clinic_id: appointment.clinic_id,
          type: "appointment_reminder",
          target_id: appointment.id,
          scheduled_for: reminderDate.toISOString(),
          status: "pending"
        });
      }
    }
  } catch (err) {
    console.error("Failed to schedule appointment reminder:", err);
  }
  
  return appointment;
}

export async function updateAppointment(
  id: number,
  update: Partial<Omit<Appointment, "id" | "pet_id" | "created_at">>
): Promise<Appointment> {
  // Fetch existing appointment first
  const { data: existing } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .single();
  
  if (!existing) throw new Error("Appointment not found");
  
  const { data, error } = await supabase
    .from("appointments")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  
  const appointment = data as Appointment;
  
  // Cancel existing pending reminders if appointment is cancelled or completed
  if (update.status && (update.status === "cancelled" || update.status === "completed")) {
    await supabase
      .from("notification_queue")
      .update({ status: "cancelled", error_message: "Appointment cancelled/completed" })
      .eq("type", "appointment_reminder")
      .eq("target_id", id)
      .eq("status", "pending");
  }
  
  // Reschedule reminder if date/time changed
  if (update.scheduled_at && existing.scheduled_at !== update.scheduled_at) {
    try {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("appointment_reminders_enabled, appointment_reminder_hours_before")
        .eq("id", appointment.clinic_id)
        .single();
      
      if (clinic?.appointment_reminders_enabled) {
        // Cancel old pending reminders
        await supabase
          .from("notification_queue")
          .update({ status: "cancelled", error_message: "Appointment rescheduled" })
          .eq("type", "appointment_reminder")
          .eq("target_id", id)
          .eq("status", "pending");
        
        // Create new reminder
        const scheduledDate = new Date(appointment.scheduled_at);
        const reminderDate = new Date(scheduledDate.getTime() - (clinic.appointment_reminder_hours_before || 24) * 60 * 60 * 1000);
        
        if (reminderDate > new Date()) {
          await supabase.from("notification_queue").insert({
            clinic_id: appointment.clinic_id,
            type: "appointment_reminder",
            target_id: appointment.id,
            scheduled_for: reminderDate.toISOString(),
            status: "pending"
          });
        }
      }
    } catch (err) {
      console.error("Failed to reschedule appointment reminder:", err);
    }
  }
  
  return appointment;
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
    .eq("clinic_id", clinicId);

  if (ownersError) throw ownersError;

  // Fetch all pets for owners in this clinic
  const ownerIds = (owners || []).map(o => o.id);
  const { data: pets, error: petsError } = await supabase
    .from("pets")
    .select("*")
    .in("owner_id", ownerIds);

  if (petsError) throw petsError;

  // Fetch all appointments for pets in this clinic
  const petIds = (pets || []).map(p => p.id);
  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select("*")
    .in("pet_id", petIds);

  if (appointmentsError) throw appointmentsError;

  // Fetch all visits for pets in this clinic
  const { data: visits, error: visitsError } = await supabase
    .from("visits")
    .select("*")
    .in("pet_id", petIds);

  if (visitsError) throw visitsError;

  // Fetch all recalls for pets in this clinic
  const { data: recalls, error: recallsError } = await supabase
    .from("recalls")
    .select("*")
    .in("pet_id", petIds);

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
    owner_name: ownerMap.get(pet.owner_id)?.name 
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

export async function createAppointmentReminder(
  clinicId: number,
  appointmentId: number,
  scheduledFor: string
): Promise<NotificationQueue> {
  const { data, error } = await supabase
    .from("notification_queue")
    .insert({
      clinic_id: clinicId,
      type: "appointment_reminder",
      target_id: appointmentId,
      scheduled_for: scheduledFor,
      status: "pending",
    })
    .select()
    .single()

  if (error) throw error

  return data as NotificationQueue
}

export async function createVaccineReminder(
  clinicId: number,
  recallId: number,
  scheduledFor: string
): Promise<NotificationQueue> {
  const { data, error } = await supabase
    .from("notification_queue")
    .insert({
      clinic_id: clinicId,
      type: "vaccine_reminder",
      target_id: recallId,
      scheduled_for: scheduledFor,
      status: "pending",
    })
    .select()
    .single()

  if (error) throw error

  return data as NotificationQueue
}

export async function recordSentEmail(
  clinicId: number,
  notificationQueueId: number | null,
  recipientEmail: string,
  subject: string,
  body: string,
  status: 'sent' | 'failed' | 'bounced' = 'sent',
  errorMessage: string | null = null
): Promise<SentEmail> {
  const { data, error } = await supabase
    .from("sent_emails")
    .insert({
      clinic_id: clinicId,
      notification_queue_id: notificationQueueId,
      recipient_email: recipientEmail,
      subject,
      body,
      status,
      error_message: errorMessage,
    })
    .select()
    .single()

  if (error) throw error

  return data as SentEmail
}

export async function updateNotificationStatus(
  queueId: number,
  status: 'sent' | 'failed' | 'cancelled',
  errorMessage: string | null = null
): Promise<NotificationQueue> {
  const { data, error } = await supabase
    .from("notification_queue")
    .update({
      status,
      error_message: errorMessage,
    })
    .eq("id", queueId)
    .select()
    .single()

  if (error) throw error

  return data as NotificationQueue
}

export async function sendTestEmail(clinicId: number, testEmail?: string): Promise<{ success: boolean; message: string }> {
  // Validate inputs
  if (!clinicId) {
    throw new Error('Clinic ID is required')
  }

  if (testEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
    throw new Error('Invalid email address format')
  }

  const { data, error } = await supabase.functions.invoke('send-test-email', {
    body: { clinicId, testEmail }
  })

  if (error) {
    // Extract the actual error message from the Edge Function response
    const errorMessage = error.message || error.context?.message || JSON.stringify(error)
    throw new Error(errorMessage)
  }

  return data as { success: boolean; message: string }
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
