import { eq } from "drizzle-orm";
import {
  appointmentsTable,
  db,
  ownersTable,
  petsTable,
  recallsTable,
  visitsTable,
} from "@workspace/db";

/** Resolves the clinicId that owns a given owner record, or null if it doesn't exist. */
export async function getOwnerClinicId(ownerId: number): Promise<number | null> {
  const [row] = await db
    .select({ clinicId: ownersTable.clinicId })
    .from(ownersTable)
    .where(eq(ownersTable.id, ownerId));
  return row?.clinicId ?? null;
}

/** Resolves the clinicId that owns a given pet record (via its owner), or null if it doesn't exist. */
export async function getPetClinicId(petId: number): Promise<number | null> {
  const [row] = await db
    .select({ clinicId: ownersTable.clinicId })
    .from(petsTable)
    .innerJoin(ownersTable, eq(petsTable.ownerId, ownersTable.id))
    .where(eq(petsTable.id, petId));
  return row?.clinicId ?? null;
}

/** Resolves the clinicId for a given appointment (via pet -> owner), or null if it doesn't exist. */
export async function getAppointmentClinicId(
  appointmentId: number,
): Promise<number | null> {
  const [row] = await db
    .select({ clinicId: ownersTable.clinicId })
    .from(appointmentsTable)
    .innerJoin(petsTable, eq(appointmentsTable.petId, petsTable.id))
    .innerJoin(ownersTable, eq(petsTable.ownerId, ownersTable.id))
    .where(eq(appointmentsTable.id, appointmentId));
  return row?.clinicId ?? null;
}

/** Resolves the clinicId for a given visit (via pet -> owner), or null if it doesn't exist. */
export async function getVisitClinicId(visitId: number): Promise<number | null> {
  const [row] = await db
    .select({ clinicId: ownersTable.clinicId })
    .from(visitsTable)
    .innerJoin(petsTable, eq(visitsTable.petId, petsTable.id))
    .innerJoin(ownersTable, eq(petsTable.ownerId, ownersTable.id))
    .where(eq(visitsTable.id, visitId));
  return row?.clinicId ?? null;
}

/** Resolves the clinicId for a given recall (via pet -> owner), or null if it doesn't exist. */
export async function getRecallClinicId(recallId: number): Promise<number | null> {
  const [row] = await db
    .select({ clinicId: ownersTable.clinicId })
    .from(recallsTable)
    .innerJoin(petsTable, eq(recallsTable.petId, petsTable.id))
    .innerJoin(ownersTable, eq(petsTable.ownerId, ownersTable.id))
    .where(eq(recallsTable.id, recallId));
  return row?.clinicId ?? null;
}
