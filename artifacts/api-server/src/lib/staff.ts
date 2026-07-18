import { clerkClient } from "@clerk/express";
import { clinicsTable, db, staffTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";
import type { Staff } from "@workspace/db";

/**
 * Fetches the staff record for a Clerk user, provisioning one on first
 * sign-in (JIT). The very first staff member ever created also gets a new
 * clinic and becomes its admin. Everyone after joins that same clinic
 * (VetDesk is currently single-clinic-per-deployment) and defaults to
 * front_desk.
 */
export async function getOrCreateStaff(clerkUserId: string): Promise<Staff> {
  const [existing] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.clerkUserId, clerkUserId));

  if (existing) {
    return existing;
  }

  const user = await clerkClient.users.getUser(clerkUserId);
  const email = user.emailAddresses[0]?.emailAddress ?? "";
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || email;

  const [{ value: staffCount }] = await db
    .select({ value: count() })
    .from(staffTable);
  const isFirstStaff = (staffCount ?? 0) === 0;

  let clinicId: number;
  if (isFirstStaff) {
    const [clinic] = await db
      .insert(clinicsTable)
      .values({ name: name ? `${name}'s Clinic` : "New Clinic" })
      .returning();
    if (!clinic) {
      throw new Error("Failed to create clinic");
    }
    clinicId = clinic.id;
  } else {
    const [clinic] = await db
      .select({ id: clinicsTable.id })
      .from(clinicsTable)
      .orderBy(clinicsTable.createdAt)
      .limit(1);
    if (!clinic) {
      throw new Error("No clinic exists to assign staff to");
    }
    clinicId = clinic.id;
  }

  const [created] = await db
    .insert(staffTable)
    .values({
      clerkUserId,
      name,
      email,
      clinicId,
      role: isFirstStaff ? "admin" : "front_desk",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create staff record");
  }

  return created;
}
