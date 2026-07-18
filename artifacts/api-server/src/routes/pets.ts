import { Router, type IRouter } from "express";
import { and, eq, ilike } from "drizzle-orm";
import {
  db,
  ownersTable,
  petsTable,
  recallsTable,
  visitsTable,
} from "@workspace/db";
import {
  ListPetsQueryParams,
  ListPetsResponse,
  CreatePetBody,
  CreatePetResponse,
  GetPetParams,
  GetPetResponse,
  UpdatePetParams,
  UpdatePetBody,
  UpdatePetResponse,
  DeletePetParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { attachStaff, requireRole, type StaffRequest } from "../middlewares/requireStaff";
import { getOwnerClinicId, getPetClinicId } from "../lib/clinicScope";

const router: IRouter = Router();

router.get(
  "/pets",
  requireAuth,
  attachStaff,
  async (req: StaffRequest, res): Promise<void> => {
    const query = ListPetsQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    const { ownerId, search } = query.data;
    const conditions = [
      ownerId !== undefined ? eq(petsTable.ownerId, ownerId) : undefined,
      search ? ilike(petsTable.name, `%${search}%`) : undefined,
    ].filter((c) => c !== undefined);

    const rows = await db
      .select({ pet: petsTable })
      .from(petsTable)
      .innerJoin(ownersTable, eq(petsTable.ownerId, ownersTable.id))
      .where(
        and(eq(ownersTable.clinicId, req.staff!.clinicId!), ...conditions),
      )
      .orderBy(petsTable.name);

    const pets = rows.map((row) => row.pet);
    ListPetsResponse.parse(pets);
    res.json(pets);
  },
);

router.post(
  "/pets",
  requireAuth,
  attachStaff,
  requireRole("admin", "front_desk"),
  async (req: StaffRequest, res): Promise<void> => {
    const parsed = CreatePetBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const ownerClinicId = await getOwnerClinicId(parsed.data.ownerId);
    if (ownerClinicId === null) {
      res.status(404).json({ error: "Owner not found" });
      return;
    }
    if (ownerClinicId !== req.staff!.clinicId!) {
      res.status(404).json({ error: "Owner not found" });
      return;
    }

    const [pet] = await db
      .insert(petsTable)
      .values({
        ...parsed.data,
        birthDate: parsed.data.birthDate
          ? parsed.data.birthDate.toISOString().slice(0, 10)
          : parsed.data.birthDate,
      })
      .returning();
    CreatePetResponse.parse(pet);
    res.status(201).json(pet);
  },
);

router.get(
  "/pets/:id",
  requireAuth,
  attachStaff,
  async (req: StaffRequest, res): Promise<void> => {
    const params = GetPetParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [pet] = await db
      .select()
      .from(petsTable)
      .where(eq(petsTable.id, params.data.id));

    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    const [owner] = await db
      .select()
      .from(ownersTable)
      .where(eq(ownersTable.id, pet.ownerId));

    if (!owner || owner.clinicId !== req.staff!.clinicId!) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    const visits = await db
      .select()
      .from(visitsTable)
      .where(eq(visitsTable.petId, pet.id))
      .orderBy(visitsTable.visitDate);

    const recalls = await db
      .select()
      .from(recallsTable)
      .where(eq(recallsTable.petId, pet.id))
      .orderBy(recallsTable.dueDate);

    GetPetResponse.parse({ ...pet, owner, visits, recalls });
    res.json({ ...pet, owner, visits, recalls });
  },
);

router.patch(
  "/pets/:id",
  requireAuth,
  attachStaff,
  requireRole("admin", "front_desk"),
  async (req: StaffRequest, res): Promise<void> => {
    const params = UpdatePetParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdatePetBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const existingClinicId = await getPetClinicId(params.data.id);
    if (existingClinicId === null || existingClinicId !== req.staff!.clinicId!) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    if ((parsed.data as any).ownerId !== undefined) {
      const newOwnerClinicId = await getOwnerClinicId((parsed.data as any).ownerId);
      if (newOwnerClinicId === null || newOwnerClinicId !== req.staff!.clinicId!) {
        res.status(404).json({ error: "Owner not found" });
        return;
      }
    }

    const [pet] = await db
      .update(petsTable)
      .set({
        ...parsed.data,
        birthDate: parsed.data.birthDate
          ? parsed.data.birthDate.toISOString().slice(0, 10)
          : parsed.data.birthDate,
      })
      .where(eq(petsTable.id, params.data.id))
      .returning();

    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    UpdatePetResponse.parse(pet);
    res.json(pet);
  },
);

router.delete(
  "/pets/:id",
  requireAuth,
  attachStaff,
  requireRole("admin", "front_desk"),
  async (req: StaffRequest, res): Promise<void> => {
    const params = DeletePetParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const existingClinicId = await getPetClinicId(params.data.id);
    if (existingClinicId === null || existingClinicId !== req.staff!.clinicId!) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    const [pet] = await db
      .delete(petsTable)
      .where(eq(petsTable.id, params.data.id))
      .returning();

    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
