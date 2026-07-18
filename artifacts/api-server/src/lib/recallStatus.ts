import { db, recallsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

/**
 * Recomputes upcoming/due/overdue status for recalls that haven't been sent
 * or completed yet, based on today's date vs. dueDate. Sent/completed recalls
 * are left alone -- they're terminal states set explicitly by staff.
 */
export async function refreshRecallStatuses(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const dueSoon = new Date();
  dueSoon.setUTCDate(dueSoon.getUTCDate() + 14);
  const dueSoonStr = dueSoon.toISOString().slice(0, 10);

  const openRecalls = await db
    .select()
    .from(recallsTable)
    .where(inArray(recallsTable.status, ["upcoming", "due", "overdue"]));

  for (const recall of openRecalls) {
    let nextStatus: "upcoming" | "due" | "overdue" = "upcoming";
    if (recall.dueDate < today) {
      nextStatus = "overdue";
    } else if (recall.dueDate <= dueSoonStr) {
      nextStatus = "due";
    }
    if (nextStatus !== recall.status) {
      await db
        .update(recallsTable)
        .set({ status: nextStatus })
        .where(eq(recallsTable.id, recall.id));
    }
  }
}
