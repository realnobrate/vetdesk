# Memory Index

- [Orval date coercion pitfalls](orval-date-coercion.md) — query-param dates need explicit coerce config; response schemas shouldn't drive what you send over the wire.
- [Drizzle date-mode string columns](drizzle-date-string-columns.md) — `date(mode:"string")` columns need manual Date→string conversion in every write path.
- [Stale workspace lib dist output](stale-lib-dist-typescript.md) — deleting dist/tsbuildinfo and rerunning tsc --build fixes false TS2305 after adding schema exports.
- [VetDesk product scope decisions](vetdesk-scope-decisions.md) — SMS/Twilio declined, Appointment entity added beyond brief, JIT staff provisioning rule.
