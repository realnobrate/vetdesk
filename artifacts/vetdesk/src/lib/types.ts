// Shared types that match the database schema
export interface Clinic {
  id: number;
  name: string;
  created_at: string;
}

export interface Staff {
  id: number;
  user_id: string;
  clinic_id: number | null;
  name: string;
  email: string;
  role: "admin" | "vet" | "front_desk";
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
}

export interface Pet {
  id: number;
  owner_id: number;
  name: string;
  species: "dog" | "cat" | "other";
  breed: string | null;
  sex: "male" | "female" | "unknown" | null;
  birth_date: string | null;
  weight_lb: number | null;
  notes: string | null;
  photo_url?: string | null;
  created_at: string;
}

export interface Visit {
  id: number;
  pet_id: number;
  visit_date: string;
  reason: string;
  notes: string | null;
  weight_lb: number | null;
  meds_prescribed: string | null;
  vaccines_administered: string[];
  vet_name: string | null;
  created_at: string;
  photos?: VisitPhoto[]
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
export interface Clinic {
  id: number
  name: string
  logo_url: string | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  working_hours: string | null
  appointment_reminders_enabled: boolean
  recall_reminders_enabled: boolean
  appointment_reminder_hours_before: number
  recall_reminder_days_before: number
  email_sender_name: string
  reply_to_email: string | null
  created_at: string
}

export interface NotificationQueue {
  id: number
  clinic_id: number
  type: 'appointment_reminder' | 'vaccine_reminder'
  target_id: number
  scheduled_for: string
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  error_message: string | null
  created_at: string
  updated_at: string
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