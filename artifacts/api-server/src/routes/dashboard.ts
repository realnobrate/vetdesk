import { Router, type IRouter } from "express";
import { and, eq, gte, lt } from "drizzle-orm";
import {
  appointmentsTable,
  db,
  ownersTable,
  petsTable,
  recallsTable,
  visitsTable,
} from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { attachStaff, type StaffRequest } from "../middlewares/requireStaff";
import { refreshRecallStatuses } from "../lib/recallStatus";

const router: IRouter = Router();

router.get(
  "/dashboard/summary",
  requireAuth,
  attachStaff,
  async (req: StaffRequest, res): Promise<void> => {
    await refreshRecallStatuses();
    const clinicId = req.staff!.clinicId!;

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const todayAppointmentsRaw = await db
      .select({
        appointment: appointmentsTable,
        pet: petsTable,
        owner: ownersTable,
      })
      .from(appointmentsTable)
      .innerJoin(petsTable, eq(appointmentsTable.petId, petsTable.id))
      .innerJoin(ownersTable, eq(petsTable.ownerId, ownersTable.id))
      .where(
        and(
          eq(ownersTable.clinicId, clinicId),
          gte(appointmentsTable.scheduledAt, startOfDay),
          lt(appointmentsTable.scheduledAt, endOfDay),
        ),
      )
      .orderBy(appointmentsTable.scheduledAt);

    const overdueRecallsRaw = await db
      .select({
        recall: recallsTable,
        pet: petsTable,
        owner: ownersTable,
      })
      .from(recallsTable)
      .innerJoin(petsTable, eq(recallsTable.petId, petsTable.id))
      .innerJoin(ownersTable, eq(petsTable.ownerId, ownersTable.id))
      .where(
        and(
          eq(ownersTable.clinicId, clinicId),
          eq(recallsTable.status, "overdue"),
        ),
      )
      .orderBy(recallsTable.dueDate);

    const upcomingAndDue = await db
      .select({ recall: recallsTable })
      .from(recallsTable)
      .innerJoin(petsTable, eq(recallsTable.petId, petsTable.id))
      .innerJoin(ownersTable, eq(petsTable.ownerId, ownersTable.id))
      .where(
        and(eq(ownersTable.clinicId, clinicId), eq(recallsTable.status, "due")),
      );
    const upcomingOnly = await db
      .select({ recall: recallsTable })
      .from(recallsTable)
      .innerJoin(petsTable, eq(recallsTable.petId, petsTable.id))
      .innerJoin(ownersTable, eq(petsTable.ownerId, ownersTable.id))
      .where(
        and(
          eq(ownersTable.clinicId, clinicId),
          eq(recallsTable.status, "upcoming"),
        ),
      );

    const recentVisitsRaw = await db
      .select({ visit: visitsTable })
      .from(visitsTable)
      .innerJoin(petsTable, eq(visitsTable.petId, petsTable.id))
      .innerJoin(ownersTable, eq(petsTable.ownerId, ownersTable.id))
      .where(eq(ownersTable.clinicId, clinicId))
      .orderBy(visitsTable.visitDate)
      .limit(10);

    const summary = {
      todayAppointments: todayAppointmentsRaw.map((row) => ({
        ...row.appointment,
        pet: row.pet,
        owner: row.owner,
      })),
      overdueRecalls: overdueRecallsRaw.map((row) => ({
        ...row.recall,
        pet: row.pet,
        owner: row.owner,
      })),
      upcomingRecallsCount: upcomingAndDue.length + upcomingOnly.length,
      recentVisits: recentVisitsRaw.map((row) => row.visit).reverse(),
    };

    GetDashboardSummaryResponse.parse(summary);
    res.json(summary);
  },
);

export default router;
