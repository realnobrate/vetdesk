import {
  appointmentsTable,
  db,
  ownersTable,
  petsTable,
  pool,
  recallsTable,
  staffTable,
  visitsTable,
} from "../src";

async function main() {
  const existing = await db.select().from(ownersTable).limit(1);
  if (existing.length > 0) {
    console.log("Seed data already present, skipping.");
    return;
  }

  const [owner1] = await db
    .insert(ownersTable)
    .values({
      firstName: "Maria",
      lastName: "Delgado",
      email: "maria.delgado@example.com",
      phone: "555-0142",
      address: "12 Birchwood Ln",
    })
    .returning();

  const [owner2] = await db
    .insert(ownersTable)
    .values({
      firstName: "Jonah",
      lastName: "Ecker",
      email: "jonah.ecker@example.com",
      phone: "555-0187",
      address: "88 Prairie View Rd",
    })
    .returning();

  if (!owner1 || !owner2) throw new Error("Failed to seed owners");

  const [pet1] = await db
    .insert(petsTable)
    .values({
      ownerId: owner1.id,
      name: "Biscuit",
      species: "dog",
      breed: "Labrador Retriever",
      sex: "male",
      birthDate: "2020-03-14",
      weightLb: 62,
      notes: "Friendly, a bit anxious around nail trims.",
    })
    .returning();

  const [pet2] = await db
    .insert(petsTable)
    .values({
      ownerId: owner2.id,
      name: "Willow",
      species: "cat",
      breed: "Domestic Shorthair",
      sex: "female",
      birthDate: "2018-11-02",
      weightLb: 9.5,
      notes: "Indoor only.",
    })
    .returning();

  if (!pet1 || !pet2) throw new Error("Failed to seed pets");

  const today = new Date();
  const visitDate = new Date(today);
  visitDate.setDate(visitDate.getDate() - 30);

  const [visit1] = await db
    .insert(visitsTable)
    .values({
      petId: pet1.id,
      visitDate,
      reason: "Annual wellness exam",
      notes: "All vitals normal.",
      weightLb: 62,
      vaccinesAdministered: ["Rabies", "DHPP"],
      vetName: "Dr. Osei",
    })
    .returning();

  if (visit1) {
    await db.insert(recallsTable).values([
      {
        petId: pet1.id,
        visitId: visit1.id,
        recallType: "Rabies",
        dueDate: "2026-08-15",
        status: "due",
      },
      {
        petId: pet1.id,
        visitId: visit1.id,
        recallType: "DHPP",
        dueDate: "2027-06-08",
        status: "upcoming",
      },
    ]);
  }

  await db.insert(visitsTable).values({
    petId: pet2.id,
    visitDate: new Date(today.getFullYear(), today.getMonth() - 2, 10),
    reason: "Dental cleaning",
    notes: "Mild tartar buildup, resolved.",
    weightLb: 9.5,
    vaccinesAdministered: [],
    vetName: "Dr. Osei",
  });

  await db.insert(recallsTable).values({
    petId: pet2.id,
    recallType: "FVRCP",
    dueDate: "2026-06-01",
    status: "overdue",
    notes: "Manually scheduled follow-up.",
  });

  const appt = new Date();
  appt.setHours(10, 30, 0, 0);
  const appt2 = new Date();
  appt2.setHours(14, 0, 0, 0);

  await db.insert(appointmentsTable).values([
    { petId: pet1.id, scheduledAt: appt, reason: "Nail trim + checkup" },
    { petId: pet2.id, scheduledAt: appt2, reason: "Follow-up dental check" },
  ]);

  await db.insert(staffTable).values([
    {
      clerkUserId: "seed-placeholder-vet",
      name: "Dr. Amara Osei",
      email: "amara.osei@vetdesk.example",
      role: "vet",
    },
  ]);

  console.log("Seed data inserted.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
