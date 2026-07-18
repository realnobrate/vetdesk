import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, staffTable } from "@workspace/db";
import {
  GetCurrentStaffResponse,
  ListStaffResponse,
  UpdateStaffParams,
  UpdateStaffBody,
  UpdateStaffResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { attachStaff, requireRole, type StaffRequest } from "../middlewares/requireStaff";

const router: IRouter = Router();

router.get(
  "/staff/me",
  requireAuth,
  attachStaff,
  async (req: StaffRequest, res): Promise<void> => {
    GetCurrentStaffResponse.parse(req.staff);
    res.json(req.staff);
  },
);

router.get(
  "/staff",
  requireAuth,
  attachStaff,
  async (req: StaffRequest, res): Promise<void> => {
    const staff = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.clinicId, req.staff!.clinicId!))
      .orderBy(staffTable.createdAt);
    ListStaffResponse.parse(staff);
    res.json(staff);
  },
);

router.patch(
  "/staff/:id",
  requireAuth,
  attachStaff,
  requireRole("admin"),
  async (req: StaffRequest, res): Promise<void> => {
    const params = UpdateStaffParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateStaffBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [staff] = await db
      .update(staffTable)
      .set(parsed.data)
      .where(
        and(
          eq(staffTable.id, params.data.id),
          eq(staffTable.clinicId, req.staff!.clinicId!),
        ),
      )
      .returning();

    if (!staff) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }

    UpdateStaffResponse.parse(staff);
    res.json(staff);
  },
);

export default router;
