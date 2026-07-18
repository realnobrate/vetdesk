import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, recallsTable, visitsTable, petsTable } from "@workspace/db";
import {
  ListPetVisitsParams,
  ListPetVisitsResponse,
  CreateVisitParams,
  CreateVisitBody,
  CreateVisitResponse,
  UpdateVisitParams,
  UpdateVisitBody,
  UpdateVisitResponse,
  DeleteVisitParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { attachStaff, requireRole, type StaffRequest } from "../middlewares/requireStaff";
import { getPetClinicId, getVisitClinicId } from "../lib/clinicScope";
import { addMonthsToDateString, resolveRecallMonths } from "../lib/recallRules";

const router: IRouter = Router();

router.get(
  "/pets/:petId/visits",
  requireAuth,
  attachStaff,
  async (req: StaffRequest, res): Promise<void> => {
    const params = ListPetVisitsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const petClinicId = await getPetClinicId(params.data.petId);
    if (petClinicId === null || petClinicId !== req.staff!.clinicId) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    const visits = await db
      .select()
      .from(visitsTable)
      .where(eq(visitsTable.petId, params.data.petId))
      .orderBy(visitsTable.visitDate);

    ListPetVisitsResponse.parse(visits);
    res.json(visits);
  },
);

router.post(
  "/pets/:petId/visits",
  requireAuth,
  attachStaff,
  requireRole("admin", "vet"),
  async (req: StaffRequest, res): Promise<void> => {
    const params = CreateVisitParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = CreateVisitBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const petClinicId = await getPetClinicId(params.data.petId);
    if (petClinicId === null || petClinicId !== req.staff!.clinicId) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    const [visit] = await db
      .insert(visitsTable)
      .values({ ...parsed.data, petId: params.data.petId })
      .returning();

    if (!visit) {
      res.status(500).json({ error: "Failed to create visit" });
      return;
    }

    const visitDateStr = visit.visitDate.toISOString().slice(0, 10);
    for (const vaccine of visit.vaccinesAdministered) {
      const months = resolveRecallMonths(vaccine);
      if (months === null) continue;
      await db.insert(recallsTable).values({
        petId: visit.petId,
        visitId: visit.id,
        recallType: vaccine,
        dueDate: addMonthsToDateString(visitDateStr, months),
        status: "upcoming",
      });
    }

    CreateVisitResponse.parse(visit);
    res.status(201).json(visit);
  },
);

router.patch(
  "/visits/:id",
  requireAuth,
  attachStaff,
  requireRole("admin", "vet"),
  async (req: StaffRequest, res): Promise<void> => {
    const params = UpdateVisitParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateVisitBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const existingClinicId = await getVisitClinicId(params.data.id);
    if (existingClinicId === null || existingClinicId !== req.staff!.clinicId) {
      res.status(404).json({ error: "Visit not found" });
      return;
    }

    const [visit] = await db
      .update(visitsTable)
      .set(parsed.data)
      .where(eq(visitsTable.id, params.data.id))
      .returning();

    if (!visit) {
      res.status(404).json({ error: "Visit not found" });
      return;
    }

    UpdateVisitResponse.parse(visit);
    res.json(visit);
  },
);

router.delete(
  "/visits/:id",
  requireAuth,
  attachStaff,
  requireRole("admin", "vet"),
  async (req: StaffRequest, res): Promise<void> => {
    const params = DeleteVisitParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const existingClinicId = await getVisitClinicId(params.data.id);
    if (existingClinicId === null || existingClinicId !== req.staff!.clinicId) {
      res.status(404).json({ error: "Visit not found" });
      return;
    }

    const [visit] = await db
      .delete(visitsTable)
      .where(eq(visitsTable.id, params.data.id))
      .returning();

    if (!visit) {
      res.status(404).json({ error: "Visit not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
