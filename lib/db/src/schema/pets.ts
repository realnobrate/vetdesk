import {
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ownersTable } from "./owners";

export const petsTable = pgTable("pets", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => ownersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  species: text("species").notNull(), // dog | cat | other
  breed: text("breed"),
  sex: text("sex"), // male | female | unknown
  birthDate: date("birth_date", { mode: "string" }),
  weightLb: numeric("weight_lb", { mode: "number" }),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPetSchema = createInsertSchema(petsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPet = z.infer<typeof insertPetSchema>;
export type Pet = typeof petsTable.$inferSelect;
