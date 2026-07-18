---
name: Orval date coercion pitfalls
description: orval/zod codegen coerce config is section-scoped (query/param/body/response); mismatches cause 400s or wrong response formats.
---

orval's zod `coerce` override config (in `orval.config.ts`) is applied per section: `query`, `param`, `body`, `response`. Adding `'date'` to `body`/`response` but not `query` means date-only query params (e.g. `?date=2026-07-10`) get validated with plain `zod.date()`, which rejects strings — breaking any GET endpoint that filters by a date query param. Fix: include `'date'` in the `query` coerce list too.

Separately: don't let response Zod schemas dictate what you actually send over the wire. If a response schema coerces a DB-native date-only string into a `Date` object (for validation), calling `res.json(Schema.parse(dbRow))` sends the *parsed* value, which serializes as a full ISO datetime — violating an OpenAPI `format: date` contract (should be `YYYY-MM-DD`). Timestamp (`format: date-time`) fields are fine either way since Date→ISO string round-trips correctly.

**How to apply:** In Express routes generated against orval/Zod schemas, validate with `Schema.parse(data)` for type-safety, but respond with `res.json(data)` (the original object from the DB/insert), not the parsed return value — this preserves date-only fields as plain date strings.

Third gotcha: once a query param schema uses `zod.coerce.date()`, `query.data.<field>` in route code is a real `Date` object, not a string — template-stringing it (e.g. `` `${date}T00:00:00.000Z` ``) interpolates `Date.toString()` (e.g. "Fri Jul 10 2026 ...") and produces an invalid date, which throws `RangeError: Invalid time value` deep inside the DB driver on `.toISOString()`, surfacing as an opaque 500. Fix: treat the coerced value as a `Date` directly (`new Date(date); d.setUTCHours(0,0,0,0)`), never re-stringify it into an ISO template.
