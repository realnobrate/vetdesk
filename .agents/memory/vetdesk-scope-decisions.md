---
name: VetDesk product scope decisions
description: Durable product/scope decisions made for the VetDesk veterinary CRM artifact, for consistency in future work on it.
---

- SMS/Twilio delivery for recall reminders was explicitly declined by the user. Recalls exist as data/status only (`upcoming`/`due`/`overdue`/`sent`/`completed`), with no actual message sending. Revisit only if the user asks for it again.
- An `Appointment` entity was added beyond the literal product brief, to make "today's appointments" on the dashboard meaningful. This was a deliberate scope addition, not part of the original spec.
- Recall status is recomputed lazily on read (via a `refreshRecallStatuses()` helper), not via a cron job. `sent`/`completed` are terminal states only staff can set explicitly.
- Recall auto-scheduling is driven by a fixed server-side rule table mapping vaccine/treatment name (case-insensitive) to a recall-interval in months, triggered when a visit is created with `vaccinesAdministered`.
- Staff accounts are JIT-provisioned on first Clerk login: the very first staff member ever created becomes `admin`; everyone after defaults to `front_desk`. Role changes require an existing admin (enforced server-side on the staff update route).
