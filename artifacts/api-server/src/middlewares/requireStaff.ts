import type { NextFunction, Response } from "express";
import type { StaffRole, Staff } from "@workspace/db";
import { getOrCreateStaff } from "../lib/staff";
import type { AuthedRequest } from "./requireAuth";

export interface StaffRequest extends AuthedRequest {
  staff?: Staff;
}

/**
 * Loads (or JIT-provisions) the staff record for the authenticated Clerk
 * user and attaches it to req.staff. Must run after requireAuth.
 */
export async function attachStaff(
  req: StaffRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    req.staff = await getOrCreateStaff(req.userId!);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Restricts a route to staff whose role is one of `roles`. Must run after
 * attachStaff.
 */
export function requireRole(...roles: StaffRole[]) {
  return (req: StaffRequest, res: Response, next: NextFunction): void => {
    if (!req.staff) {
      res.status(500).json({ error: "Staff context missing" });
      return;
    }
    if (!roles.includes(req.staff.role)) {
      res.status(403).json({
        error: `This action requires one of the following roles: ${roles.join(", ")}`,
      });
      return;
    }
    next();
  };
}
