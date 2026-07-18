/*
# VetDesk Complete Schema - Step 1: Tables Only

Creates all tables without cross-table RLS policies first.
Policies that reference other tables are added in step 2.
*/

-- CLINICS
CREATE TABLE IF NOT EXISTS clinics (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;

-- STAFF
CREATE TABLE IF NOT EXISTS staff (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id bigint REFERENCES clinics(id) ON DELETE RESTRICT,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'front_desk',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_user_id_unique ON staff(user_id);
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- OWNERS
CREATE TABLE IF NOT EXISTS owners (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  clinic_id bigint NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text NOT NULL,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE owners ENABLE ROW LEVEL SECURITY;

-- PETS
CREATE TABLE IF NOT EXISTS pets (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  owner_id bigint NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name text NOT NULL,
  species text NOT NULL DEFAULT 'dog',
  breed text,
  sex text DEFAULT 'unknown',
  birth_date date,
  weight_lb numeric(7,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

-- VISITS
CREATE TABLE IF NOT EXISTS visits (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pet_id bigint NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  visit_date timestamptz NOT NULL,
  reason text NOT NULL,
  notes text,
  weight_lb numeric(7,2),
  meds_prescribed text,
  vaccines_administered text[] NOT NULL DEFAULT '{}',
  vet_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- RECALLS
CREATE TABLE IF NOT EXISTS recalls (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pet_id bigint NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  visit_id bigint REFERENCES visits(id) ON DELETE SET NULL,
  recall_type text NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'upcoming',
  sent_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recalls ENABLE ROW LEVEL SECURITY;

-- APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pet_id bigint NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
