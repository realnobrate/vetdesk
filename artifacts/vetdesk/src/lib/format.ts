import { format } from "date-fns"

export function formatDate(date: string | undefined | null, formatStr: string = "MMM d, yyyy") {
  if (!date) return "—"
  try {
    return format(new Date(date), formatStr)
  } catch (e) {
    return date
  }
}
