---
name: Drizzle date-mode string columns
description: date(mode:"string") columns need manual Date-to-string conversion in every insert/update when the input comes from an OpenAPI format:date field.
---

When an OpenAPI schema declares a field as `format: date` (date-only, e.g. `birthDate`, `dueDate`), orval-generated Zod (with body coerce including `date`) parses it into a JS `Date` object. If the corresponding Drizzle column is declared `date(..., { mode: "string" })`, Drizzle expects a `YYYY-MM-DD` string, not a `Date` — passing a `Date` object either throws or inserts wrong data depending on driver behavior.

**Why:** Keeping Drizzle date columns in string mode avoids timezone-shift bugs when reading, but that pushes the Date→string conversion responsibility onto every write path.

**How to apply:** In every route that inserts/updates a date-only field originating from a parsed Zod body, convert explicitly: `value ? value.toISOString().slice(0, 10) : value`. This is easy to miss when adding new date-only fields later — search all insert/update calls touching that column when adding one.
