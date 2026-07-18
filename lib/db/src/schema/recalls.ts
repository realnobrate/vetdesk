import { date, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { petsTable } from "./pets";
import { visitsTable } from "./visits";

export const recallsTable = pgTable("recalls", {
  id: serial("id").primaryKey(),
  petId: integer("pet_id")
    .notNull()
    .references(() => petsTable.id, { onDelete: "cascade" }),
  visitId: integer("visit_id").references(() => visitsTable.id, {
    onDelete: "set null",
  }),
  recallType: text("recall_type").notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("upcoming"), // upcoming | due | overdue | sent | completed
  sentAt: timestamp("sent_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertRecallSchema = createInsertSchema(recallsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRecall = z.infer<typeof insertRecallSchema>;
export type Recall = typeof recallsTable.$inferSelect;
