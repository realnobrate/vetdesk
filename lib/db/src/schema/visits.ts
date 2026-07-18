import {
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { petsTable } from "./pets";

export const visitsTable = pgTable("visits", {
  id: serial("id").primaryKey(),
  petId: integer("pet_id")
    .notNull()
    .references(() => petsTable.id, { onDelete: "cascade" }),
  visitDate: timestamp("visit_date", { withTimezone: true }).notNull(),
  reason: text("reason").notNull(),
  notes: text("notes"),
  weightLb: numeric("weight_lb", { mode: "number" }),
  medsPrescribed: text("meds_prescribed"),
  vaccinesAdministered: text("vaccines_administered")
    .array()
    .notNull()
    .default([]),
  vetName: text("vet_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertVisitSchema = createInsertSchema(visitsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertVisit = z.infer<typeof insertVisitSchema>;
export type Visit = typeof visitsTable.$inferSelect;
