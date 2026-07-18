import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";

export const STAFF_ROLES = ["front_desk", "vet", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const staffTable = pgTable("staff", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinicsTable.id, {
    onDelete: "restrict",
  }),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("front_desk").$type<StaffRole>(), // front_desk | vet | admin
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertStaffSchema = createInsertSchema(staffTable).omit({
  id: true,
  createdAt: true,
});
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staffTable.$inferSelect;
