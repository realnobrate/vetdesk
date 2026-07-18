/**
 * Fixed recall intervals for known vaccines/treatments. When a visit records
 * an administered vaccine that matches one of these (case-insensitive), the
 * server auto-schedules the follow-up recall the given number of months out.
 * Unrecognized names are simply logged on the visit with no recall created.
 */
export const RECALL_RULES: Record<string, number> = {
  rabies: 12,
  dhpp: 12,
  "dhpp booster": 12,
  bordetella: 6,
  "feline distemper": 12,
  fvrcp: 12,
  leptospirosis: 12,
  "lyme vaccine": 12,
  "canine influenza": 12,
  dental: 12,
  "heartworm test": 12,
  "flea/tick prevention": 1,
};

export function resolveRecallMonths(vaccineName: string): number | null {
  const months = RECALL_RULES[vaccineName.trim().toLowerCase()];
  return months ?? null;
}

export function addMonthsToDateString(
  isoDate: string,
  months: number,
): string {
  const date = new Date(isoDate);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}
