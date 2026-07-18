import { Router, type IRouter } from "express";
import { and, eq, gte, lt } from "drizzle-orm";
import { db, appointmentsTable, ownersTable, petsTable } from "@workspace/db";
import {
  ListAppointmentsQueryParams,
  ListAppointmentsResponse,
  CreateAppointmentBody,
  CreateAppointmentResponse,
  UpdateAppointmentParams,
  UpdateAppointmentBody,
  UpdateAppointmentResponse,
  DeleteAppointmentParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { attachStaff, requireRole, type StaffRequest } from "../middlewares/requireStaff";
import { getAppointmentClinicId, getPetClinicId } from "../lib/clinicScope";

const router: IRouter = Router();

router.get(
  "/appointments",
  requireAuth,
  attachStaff,
  async (req: StaffRequest, res): Promise<void> => {
    const query = ListAppointmentsQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    const { date } = query.data;
    let dateCondition;
    if (date) {
      const start = new Date(date);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      dateCondition = and(
        gte(appointmentsTable.scheduledAt, start),
        lt(appointmentsTable.scheduledAt, end),
      );
    }

    const rows = await db
      .select({
        appointment: appointmentsTable,
        pet: petsTable,
        owner: ownersTable,
      })
      .from(appointmentsTable)
      .innerJoin(petsTable, eq(appointmentsTable.petId, petsTable.id))
      .innerJoin(ownersTable, eq(petsTable.ownerId, ownersTable.id))
      .where(
        and(eq(ownersTable.clinicId, req.staff!.clinicId!), dateCondition),
      )
      .orderBy(appointmentsTable.scheduledAt);

    const appointments = rows.map((row) => ({
      ...row.appointment,
      pet: row.pet,
      owner: row.owner,
    }));

    ListAppointmentsResponse.parse(appointments);
    res.json(appointments);
  },
);

router.post(
  "/appointments",
  requireAuth,
  attachStaff,
  requireRole("admin", "front_desk"),
  async (req: StaffRequest, res): Promise<void> => {
    const parsed = CreateAppointmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const petClinicId = await getPetClinicId(parsed.data.petId);
    if (petClinicId === null || petClinicId !== req.staff!.clinicId!) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    const [appointment] = await db
      .insert(appointmentsTable)
      .values(parsed.data)
      .returning();
    CreateAppointmentResponse.parse(appointment);
    res.status(201).json(appointment);
  },
);

router.patch(
  "/appointments/:id",
  requireAuth,
  attachStaff,
  requireRole("admin", "front_desk"),
  async (req: StaffRequest, res): Promise<void> => {
    const params = UpdateAppointmentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateAppointmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const existingClinicId = await getAppointmentClinicId(params.data.id);
    if (existingClinicId === null || existingClinicId !== req.staff!.clinicId!) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    const [appointment] = await db
      .update(appointmentsTable)
      .set(parsed.data)
      .where(eq(appointmentsTable.id, params.data.id))
      .returning();

    if (!appointment) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    UpdateAppointmentResponse.parse(appointment);
    res.json(appointment);
  },
);

router.delete(
  "/appointments/:id",
  requireAuth,
  attachStaff,
  requireRole("admin", "front_desk"),
  async (req: StaffRequest, res): Promise<void> => {
    const params = DeleteAppointmentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const existingClinicId = await getAppointmentClinicId(params.data.id);
    if (existingClinicId === null || existingClinicId !== req.staff!.clinicId!) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    const [appointment] = await db
      .delete(appointmentsTable)
      .where(eq(appointmentsTable.id, params.data.id))
      .returning();

    if (!appointment) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
