import { Router, type IRouter } from "express";
import { and, eq, lte } from "drizzle-orm";
import { db, ownersTable, petsTable, recallsTable } from "@workspace/db";
import {
  ListRecallsQueryParams,
  ListRecallsResponse,
  CreateRecallBody,
  CreateRecallResponse,
  ListPetRecallsParams,
  ListPetRecallsResponse,
  UpdateRecallParams,
  UpdateRecallBody,
  UpdateRecallResponse,
  DeleteRecallParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { attachStaff, type StaffRequest } from "../middlewares/requireStaff";
import { getPetClinicId, getRecallClinicId } from "../lib/clinicScope";
import { refreshRecallStatuses } from "../lib/recallStatus";

const router: IRouter = Router();

router.get(
  "/recalls",
  requireAuth,
  attachStaff,
  async (req: StaffRequest, res): Promise<void> => {
    const query = ListRecallsQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    await refreshRecallStatuses();

    const { status, dueBefore } = query.data;
    const conditions = [
      eq(ownersTable.clinicId, req.staff!.clinicId!),
      status ? eq(recallsTable.status, status) : undefined,
      dueBefore
        ? lte(recallsTable.dueDate, dueBefore.toISOString().slice(0, 10))
        : undefined,
    ].filter((c) => c !== undefined);

    const rows = await db
      .select({ recall: recallsTable, pet: petsTable, owner: ownersTable })
      .from(recallsTable)
      .innerJoin(petsTable, eq(recallsTable.petId, petsTable.id))
      .innerJoin(ownersTable, eq(petsTable.ownerId, ownersTable.id))
      .where(and(...conditions))
      .orderBy(recallsTable.dueDate);

    const recalls = rows.map((row) => ({
      ...row.recall,
      pet: row.pet,
      owner: row.owner,
    }));

    ListRecallsResponse.parse(recalls);
    res.json(recalls);
  },
);

router.post(
  "/recalls",
  requireAuth,
  attachStaff,
  async (req: StaffRequest, res): Promise<void> => {
    const parsed = CreateRecallBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const petClinicId = await getPetClinicId(parsed.data.petId);
    if (petClinicId === null || petClinicId !== req.staff!.clinicId!) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    const [recall] = await db
      .insert(recallsTable)
      .values({
        ...parsed.data,
        dueDate: parsed.data.dueDate.toISOString().slice(0, 10),
      })
      .returning();
    CreateRecallResponse.parse(recall);
    res.status(201).json(recall);
  },
);

router.get(
  "/pets/:petId/recalls",
  requireAuth,
  attachStaff,
  async (req: StaffRequest, res): Promise<void> => {
    const params = ListPetRecallsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const petClinicId = await getPetClinicId(params.data.petId);
    if (petClinicId === null || petClinicId !== req.staff!.clinicId!) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    await refreshRecallStatuses();

    const recalls = await db
      .select()
      .from(recallsTable)
      .where(eq(recallsTable.petId, params.data.petId))
      .orderBy(recallsTable.dueDate);

    ListPetRecallsResponse.parse(recalls);
    res.json(recalls);
  },
);

router.patch(
  "/recalls/:id",
  requireAuth,
  attachStaff,
  async (req: StaffRequest, res): Promise<void> => {
    const params = UpdateRecallParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateRecallBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const existingClinicId = await getRecallClinicId(params.data.id);
    if (existingClinicId === null || existingClinicId !== req.staff!.clinicId!) {
      res.status(404).json({ error: "Recall not found" });
      return;
    }

    const update: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.dueDate) {
      update.dueDate = parsed.data.dueDate.toISOString().slice(0, 10);
    }
    if (parsed.data.status === "sent") {
      update.sentAt = new Date();
    }
    if (parsed.data.status === "completed") {
      update.completedAt = new Date();
    }

    const [recall] = await db
      .update(recallsTable)
      .set(update)
      .where(eq(recallsTable.id, params.data.id))
      .returning();

    if (!recall) {
      res.status(404).json({ error: "Recall not found" });
      return;
    }

    UpdateRecallResponse.parse(recall);
    res.json(recall);
  },
);

router.delete(
  "/recalls/:id",
  requireAuth,
  attachStaff,
  async (req: StaffRequest, res): Promise<void> => {
    const params = DeleteRecallParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const existingClinicId = await getRecallClinicId(params.data.id);
    if (existingClinicId === null || existingClinicId !== req.staff!.clinicId!) {
      res.status(404).json({ error: "Recall not found" });
      return;
    }

    const [recall] = await db
      .delete(recallsTable)
      .where(eq(recallsTable.id, params.data.id))
      .returning();

    if (!recall) {
      res.status(404).json({ error: "Recall not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
