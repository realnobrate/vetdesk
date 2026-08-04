// Shared types that match the database schema.
export type StaffRole = "admin" | "veterinarian" | "receptionist";

export interface Clinic {
  id: number;
  name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  working_hours: string | null;
  timezone: string | null;
  appointment_reminders_enabled: boolean;
  recall_reminders_enabled: boolean;
  appointment_reminder_hours_before: number;
  recall_reminder_days_before: number;
  email_sender_name: string;
  reply_to_email: string | null;
  created_at: string;
}

export interface Staff {
  id: number;
  user_id: string | null;
  clinic_id: number | null;
  name: string;
  email: string;
  role: StaffRole;
  created_at: string;
  status: "active" | "inactive" | "pending";
}

export interface Owner {
  id: number;
  clinic_id: number | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  address: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface Pet {
  id: number;
  clinic_id: number;
  owner_id: number;
  name: string;
  species: "dog" | "cat" | "other";
  breed: string | null;
  sex: "male" | "female" | "unknown" | null;
  birth_date: string | null;
  weight_lb: number | null;
  notes: string | null;
  microchip_number: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  important_warnings: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  reproductive_status: "intact" | "neutered" | "spayed" | "unknown" | null;
  is_deceased: boolean;
  deceased_on: string | null;
  cause_of_death: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  photo_url?: string | null;
  created_at: string;
}

export interface Visit {
  id: number;
  clinic_id: number;
  pet_id: number;
  visit_date: string;
  reason: string;
  notes: string | null;
  weight_lb: number | null;
  meds_prescribed: string | null;
  vaccines_administered: string[];
  vet_name: string | null;
  attending_staff_id: number | null;
  presenting_complaint: string | null;
  subjective_notes: string | null;
  objective_notes: string | null;
  assessment: string | null;
  differential_diagnosis: string | null;
  treatment_plan: string | null;
  follow_up_recommendations: string | null;
  internal_notes: string | null;
  temperature_celsius: number | null;
  heart_rate_bpm: number | null;
  respiratory_rate_bpm: number | null;
  body_condition_score: number | null;
  record_status: "draft" | "final" | "amended";
  finalized_at: string | null;
  updated_at: string;
  created_at: string;
  photos?: VisitPhoto[];
}

export interface CreateVisitInput {
  visit_date: string;
  reason: string;
  notes: string | null;
  weight_lb: number | null;
  meds_prescribed: string | null;
  vaccines_administered: string[];
  vet_name: string | null;
  attending_staff_id?: number | null;
  presenting_complaint?: string | null;
  subjective_notes?: string | null;
  objective_notes?: string | null;
  assessment?: string | null;
  differential_diagnosis?: string | null;
  treatment_plan?: string | null;
  follow_up_recommendations?: string | null;
  internal_notes?: string | null;
  temperature_celsius?: number | null;
  heart_rate_bpm?: number | null;
  respiratory_rate_bpm?: number | null;
  body_condition_score?: number | null;
  record_status?: "draft" | "final";
  finalized_at?: string | null;
}
export interface VisitPhoto {
  id: number;
  visit_id: number;
  photo_url: string;
  caption: string | null;
  created_at: string;
}

export interface Recall {
  id: number;
  pet_id: number;
  clinic_id: number;
  visit_id: number | null;
  recall_type: string;
  due_date: string;
  status: "upcoming" | "due" | "overdue" | "sent" | "completed";
  sent_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Appointment {
  id: number;
  pet_id: number;
  clinic_id: number;
  scheduled_at: string;
  reason: string;
  vet_name: string | null;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  created_at: string;
}

export interface OwnerWithPets extends Owner {
  pets: Pet[];
}

export interface PetDetail extends Pet {
  owner: Owner;
  visits: Visit[];
  recalls: Recall[];
}

export interface AppointmentWithPet extends Appointment {
  pet: Pet;
  owner: Owner;
}

export interface RecallWithPet extends Recall {
  pet: Pet;
  owner: Owner;
}

export interface DashboardSummary {
  todayAppointments: AppointmentWithPet[];
  overdueRecalls: RecallWithPet[];
  upcomingRecallsCount: number;
  recentVisits: Visit[];
  totalOwners: number;
  totalPets: number;
}
export interface NotificationQueue {
  id: number;
  clinic_id: number;
  type: "appointment_reminder" | "vaccine_reminder";
  target_id: number;
  scheduled_for: string;
  status: "pending" | "processing" | "sent" | "failed" | "cancelled";
  error_message: string | null;
  attempt_count: number;
  processing_started_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SentEmail {
  id: number
  clinic_id: number
  notification_queue_id: number | null
  recipient_email: string
  subject: string
  body: string
  sent_at: string
  status: 'sent' | 'failed' | 'bounced'
  error_message: string | null
  created_at: string
}

export interface EmailStatistics {
  emails_sent_today: number
  upcoming_reminders: number
  failed_emails: number
  last_successful_email: string | null
}

export interface MedicalNoteTemplate {
  id: number;
  clinic_id: number;
  name: string;
  presenting_complaint: string | null;
  subjective_notes: string | null;
  objective_notes: string | null;
  assessment: string | null;
  treatment_plan: string | null;
  follow_up_recommendations: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface Vaccination {
  id: number;
  clinic_id: number;
  pet_id: number;
  visit_id: number | null;
  recall_id: number | null;
  vaccine_name: string;
  manufacturer: string | null;
  lot_number: string | null;
  expires_on: string | null;
  administered_on: string;
  administration_site: string | null;
  veterinarian_staff_id: number | null;
  next_due_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Prescription {
  id: number;
  clinic_id: number;
  pet_id: number;
  visit_id: number | null;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string | null;
  route: string | null;
  instructions: string;
  starts_on: string;
  ends_on: string | null;
  prescriber_staff_id: number | null;
  status: "active" | "completed" | "discontinued";
  refills_allowed: number;
  refills_remaining: number;
  medication_warnings: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  discontinued_at: string | null;
  deleted_at: string | null;
}

export type LabOrderStatus =
  | "ordered"
  | "collected"
  | "processing"
  | "completed"
  | "cancelled";

export interface LabOrder {
  id: number;
  clinic_id: number;
  pet_id: number;
  visit_id: number | null;
  ordered_by_staff_id: number | null;
  reviewed_by_staff_id: number | null;
  test_name: string;
  category: string;
  laboratory_type: "internal" | "external";
  laboratory_name: string | null;
  sample_type: string | null;
  sample_collected_at: string | null;
  status: LabOrderStatus;
  result_text: string | null;
  result_numeric: number | null;
  result_unit: string | null;
  reference_range: string | null;
  is_abnormal: boolean;
  reviewed_at: string | null;
  owner_notified_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ClinicalDocument {
  id: number;
  clinic_id: number;
  pet_id: number;
  visit_id: number | null;
  lab_order_id: number | null;
  document_type: string;
  display_name: string;
  storage_path: string;
  signed_url: string | null;
  mime_type: string;
  size_bytes: number;
  client_visible: boolean;
  uploaded_by: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface ClinicalRecordData {
  pet: PetDetail;
  vaccinations: Vaccination[];
  prescriptions: Prescription[];
  labOrders: LabOrder[];
  documents: ClinicalDocument[];
  noteTemplates: MedicalNoteTemplate[];
}
