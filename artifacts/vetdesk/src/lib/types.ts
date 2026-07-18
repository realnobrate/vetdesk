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
}

export interface Recall {
  id: number;
  pet_id: number;
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
  scheduled_at: string;
  reason: string;
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
