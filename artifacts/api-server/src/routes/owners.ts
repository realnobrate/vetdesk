import { Router, type IRouter } from "express";
import { and, eq, ilike, or } from "drizzle-orm";
import { db, ownersTable, petsTable } from "@workspace/db";
import {
  ListOwnersQueryParams,
  ListOwnersResponse,
  CreateOwnerBody,
  CreateOwnerResponse,
  GetOwnerParams,
  GetOwnerResponse,
  UpdateOwnerParams,
  UpdateOwnerBody,
  UpdateOwnerResponse,
  DeleteOwnerParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { attachStaff, requireRole, type StaffRequest } from "../middlewares/requireStaff";

const router: IRouter = Router();

router.get(
  "/owners",
  requireAuth,
  attachStaff,
  async (req: StaffRequest, res): Promise<void> => {
    const query = ListOwnersQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    const { search } = query.data;
    const owners = await db
      .select()
      .from(ownersTable)
      .where(
        and(
          eq(ownersTable.clinicId, req.staff!.clinicId!),
          search
            ? or(
                ilike(ownersTable.firstName, `%${search}%`),
                ilike(ownersTable.lastName, `%${search}%`),
                ilike(ownersTable.email, `%${search}%`),
                ilike(ownersTable.phone, `%${search}%`),
              )
            : undefined,
        ),
      )
      .orderBy(ownersTable.lastName, ownersTable.firstName);

    ListOwnersResponse.parse(owners);
    res.json(owners);
  },
);

router.post(
  "/owners",
  requireAuth,
  attachStaff,
  requireRole("admin", "front_desk"),
  async (req: StaffRequest, res): Promise<void> => {
    const parsed = CreateOwnerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [owner] = await db
      .insert(ownersTable)
      .values({ ...parsed.data, clinicId: req.staff!.clinicId! })
      .returning();
    CreateOwnerResponse.parse(owner);
    res.status(201).json(owner);
  },
);

router.get(
  "/owners/:id",
  requireAuth,
  attachStaff,
  async (req: StaffRequest, res): Promise<void> => {
    const params = GetOwnerParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [owner] = await db
      .select()
      .from(ownersTable)
      .where(
        and(
          eq(ownersTable.id, params.data.id),
          eq(ownersTable.clinicId, req.staff!.clinicId!),
        ),
      );

    if (!owner) {
      res.status(404).json({ error: "Owner not found" });
      return;
    }

    const pets = await db
      .select()
      .from(petsTable)
      .where(eq(petsTable.ownerId, owner.id));

    GetOwnerResponse.parse({ ...owner, pets });
    res.json({ ...owner, pets });
  },
);

router.patch(
  "/owners/:id",
  requireAuth,
  attachStaff,
  requireRole("admin", "front_desk"),
  async (req: StaffRequest, res): Promise<void> => {
    const params = UpdateOwnerParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateOwnerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [owner] = await db
      .update(ownersTable)
      .set(parsed.data)
      .where(
        and(
          eq(ownersTable.id, params.data.id),
          eq(ownersTable.clinicId, req.staff!.clinicId!),
        ),
      )
      .returning();

    if (!owner) {
      res.status(404).json({ error: "Owner not found" });
      return;
    }

    UpdateOwnerResponse.parse(owner);
    res.json(owner);
  },
);

router.delete(
  "/owners/:id",
  requireAuth,
  attachStaff,
  requireRole("admin", "front_desk"),
  async (req: StaffRequest, res): Promise<void> => {
    const params = DeleteOwnerParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [owner] = await db
      .delete(ownersTable)
      .where(
        and(
          eq(ownersTable.id, params.data.id),
          eq(ownersTable.clinicId, req.staff!.clinicId!),
        ),
      )
      .returning();

    if (!owner) {
      res.status(404).json({ error: "Owner not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
