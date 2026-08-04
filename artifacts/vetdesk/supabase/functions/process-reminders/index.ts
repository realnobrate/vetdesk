import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  escapeHtml,
  isEmail,
  sendWithResend,
} from "../_shared/email.ts";

type SupabaseAdmin = ReturnType<typeof createClient>;

interface QueueItem {
  id: number;
  clinic_id: number;
  type: "appointment_reminder" | "vaccine_reminder";
  target_id: number;
  scheduled_for: string;
  attempt_count: number;
}

type ProcessResult = "sent" | "cancelled" | "retrying" | "failed";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isAuthorized(req: Request): boolean {
  const secret = Deno.env.get("CRON_SECRET")?.trim();
  if (!secret) return false;
  return (
    req.headers.get("x-cron-secret") === secret ||
    req.headers.get("authorization") === `Bearer ${secret}`
  );
}

async function updateQueue(
  supabase: SupabaseAdmin,
  id: number,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("notification_queue")
    .update(values)
    .eq("id", id);
  if (error) throw error;
}

async function cancelQueue(
  supabase: SupabaseAdmin,
  id: number,
  reason: string,
): Promise<"cancelled"> {
  await updateQueue(supabase, id, {
    status: "cancelled",
    error_message: reason,
    processing_started_at: null,
  });
  return "cancelled";
}

async function handleFailure(
  supabase: SupabaseAdmin,
  reminder: QueueItem,
  message: string,
): Promise<"retrying" | "failed"> {
  const attempts = reminder.attempt_count + 1;
  if (attempts < 3) {
    const retryDelayMinutes = 5 * 2 ** (attempts - 1);
    await updateQueue(supabase, reminder.id, {
      status: "pending",
      scheduled_for: new Date(Date.now() + retryDelayMinutes * 60_000).toISOString(),
      error_message: message.slice(0, 500),
      processing_started_at: null,
    });
    return "retrying";
  }

  await updateQueue(supabase, reminder.id, {
    status: "failed",
    error_message: message.slice(0, 500),
    processing_started_at: null,
  });
  return "failed";
}

async function alreadySent(
  supabase: SupabaseAdmin,
  reminderId: number,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("sent_emails")
    .select("id", { count: "exact", head: true })
    .eq("notification_queue_id", reminderId)
    .eq("status", "sent");
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function finishEmail(
  supabase: SupabaseAdmin,
  reminder: QueueItem,
  recipient: string,
  subject: string,
  html: string,
  result: { success: boolean; error?: string },
): Promise<ProcessResult> {
  const { error: recordError } = await supabase.from("sent_emails").insert({
    clinic_id: reminder.clinic_id,
    notification_queue_id: reminder.id,
    recipient_email: recipient,
    subject,
    body: html,
    status: result.success ? "sent" : "failed",
    error_message: result.error ?? null,
  });
  if (recordError) throw recordError;

  if (!result.success) {
    return handleFailure(supabase, reminder, result.error ?? "Email delivery failed");
  }

  await updateQueue(supabase, reminder.id, {
    status: "sent",
    error_message: null,
    processing_started_at: null,
  });
  return "sent";
}

async function processAppointment(
  supabase: SupabaseAdmin,
  reminder: QueueItem,
): Promise<ProcessResult> {
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("*, pets(*, owners(*))")
    .eq("id", reminder.target_id)
    .maybeSingle();
  if (error) throw error;
  if (!appointment) return cancelQueue(supabase, reminder.id, "Appointment no longer exists");
  if (appointment.clinic_id !== reminder.clinic_id) {
    return cancelQueue(supabase, reminder.id, "Clinic mismatch");
  }
  if (appointment.status !== "scheduled") {
    return cancelQueue(supabase, reminder.id, "Appointment is not scheduled");
  }

  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("name, phone, timezone, email_sender_name, reply_to_email, appointment_reminders_enabled")
    .eq("id", reminder.clinic_id)
    .single();
  if (clinicError) throw clinicError;
  if (!clinic.appointment_reminders_enabled) {
    return cancelQueue(supabase, reminder.id, "Appointment reminders disabled");
  }
  if (await alreadySent(supabase, reminder.id)) {
    await updateQueue(supabase, reminder.id, { status: "sent", processing_started_at: null });
    return "sent";
  }

  const pet = appointment.pets;
  const owner = pet?.owners;
  const recipient = String(owner?.email ?? "").trim().toLowerCase();
  if (!isEmail(recipient)) {
    return handleFailure(supabase, reminder, "Owner has no valid email address");
  }

  const timeZone = clinic.timezone || "Europe/Belgrade";
  const appointmentDate = new Date(appointment.scheduled_at);
  const dateText = appointmentDate.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone,
  });
  const timeText = appointmentDate.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone,
  });
  const clinicName = escapeHtml(clinic.name);
  const petName = escapeHtml(pet.name);
  const ownerName = escapeHtml(`${owner.first_name} ${owner.last_name}`);
  const subject = `Appointment reminder: ${pet.name} at ${clinic.name}`;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
    <main style="max-width:600px;margin:0 auto;padding:24px">
    <h1 style="color:#0d4f6c">Appointment reminder</h1>
    <p>Dear ${ownerName},</p>
    <p>This is a reminder for <strong>${petName}</strong> at <strong>${clinicName}</strong>.</p>
    <div style="border-left:4px solid #0d4f6c;padding:12px 16px;background:#f8fafc">
    <p><strong>Date:</strong> ${escapeHtml(dateText)}</p>
    <p><strong>Time:</strong> ${escapeHtml(timeText)}</p>
    <p><strong>Reason:</strong> ${escapeHtml(appointment.reason)}</p>
    </div>
    <p>Questions or changes? Contact ${clinicName}${clinic.phone ? ` at ${escapeHtml(clinic.phone)}` : ""}.</p>
    </main></body></html>`;

  const result = await sendWithResend({
    to: recipient,
    fromName: clinic.email_sender_name || "VetDesk",
    replyTo: clinic.reply_to_email || undefined,
    subject,
    html,
    idempotencyKey: `vetdesk-reminder-${reminder.id}`,
  });
  return finishEmail(supabase, reminder, recipient, subject, html, result);
}

async function processRecall(
  supabase: SupabaseAdmin,
  reminder: QueueItem,
): Promise<ProcessResult> {
  const { data: recall, error } = await supabase
    .from("recalls")
    .select("*, pets(*, owners(*))")
    .eq("id", reminder.target_id)
    .maybeSingle();
  if (error) throw error;
  if (!recall) return cancelQueue(supabase, reminder.id, "Recall no longer exists");
  if (recall.clinic_id !== reminder.clinic_id) {
    return cancelQueue(supabase, reminder.id, "Clinic mismatch");
  }
  if (recall.status === "completed") {
    return cancelQueue(supabase, reminder.id, "Recall completed");
  }

  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("name, phone, timezone, email_sender_name, reply_to_email, recall_reminders_enabled")
    .eq("id", reminder.clinic_id)
    .single();
  if (clinicError) throw clinicError;
  if (!clinic.recall_reminders_enabled) {
    return cancelQueue(supabase, reminder.id, "Recall reminders disabled");
  }
  if (await alreadySent(supabase, reminder.id)) {
    await updateQueue(supabase, reminder.id, { status: "sent", processing_started_at: null });
    return "sent";
  }

  const pet = recall.pets;
  const owner = pet?.owners;
  const recipient = String(owner?.email ?? "").trim().toLowerCase();
  if (!isEmail(recipient)) {
    return handleFailure(supabase, reminder, "Owner has no valid email address");
  }

  const timeZone = clinic.timezone || "Europe/Belgrade";
  const dueText = new Date(`${recall.due_date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone,
  });
  const clinicName = escapeHtml(clinic.name);
  const petName = escapeHtml(pet.name);
  const ownerName = escapeHtml(`${owner.first_name} ${owner.last_name}`);
  const recallType = escapeHtml(recall.recall_type);
  const subject = `Preventive care reminder: ${recall.recall_type} for ${pet.name}`;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
    <main style="max-width:600px;margin:0 auto;padding:24px">
    <h1 style="color:#0d4f6c">Preventive care reminder</h1>
    <p>Dear ${ownerName},</p>
    <p><strong>${petName}</strong> is due for <strong>${recallType}</strong>.</p>
    <div style="border-left:4px solid #0d4f6c;padding:12px 16px;background:#f8fafc">
    <p><strong>Due date:</strong> ${escapeHtml(dueText)}</p>
    </div>
    <p>Contact ${clinicName}${clinic.phone ? ` at ${escapeHtml(clinic.phone)}` : ""} to arrange an appointment.</p>
    </main></body></html>`;

  const result = await sendWithResend({
    to: recipient,
    fromName: clinic.email_sender_name || "VetDesk",
    replyTo: clinic.reply_to_email || undefined,
    subject,
    html,
    idempotencyKey: `vetdesk-reminder-${reminder.id}`,
  });
  return finishEmail(supabase, reminder, recipient, subject, html, result);
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const staleBefore = new Date(Date.now() - 15 * 60_000).toISOString();
    const { error: staleRetryError } = await supabase
      .from("notification_queue")
      .update({ status: "pending", processing_started_at: null, error_message: "Recovered stale processing job" })
      .eq("status", "processing")
      .lt("processing_started_at", staleBefore)
      .lt("attempt_count", 3);
    if (staleRetryError) throw staleRetryError;

    const { error: staleFailureError } = await supabase
      .from("notification_queue")
      .update({
        status: "failed",
        processing_started_at: null,
        error_message: "Reminder failed after three interrupted attempts",
      })
      .eq("status", "processing")
      .lt("processing_started_at", staleBefore)
      .gte("attempt_count", 3);
    if (staleFailureError) throw staleFailureError;

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("notification_queue")
      .select("id, clinic_id, type, target_id, scheduled_for, attempt_count")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .order("scheduled_for")
      .limit(50);
    if (error) throw error;

    const counts: Record<ProcessResult | "skipped", number> = {
      sent: 0, cancelled: 0, retrying: 0, failed: 0, skipped: 0,
    };

    for (const reminder of (data ?? []) as QueueItem[]) {
      const { data: claimed, error: claimError } = await supabase
        .from("notification_queue")
        .update({
          status: "processing",
          processing_started_at: new Date().toISOString(),
          attempt_count: reminder.attempt_count + 1,
        })
        .eq("id", reminder.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) {
        counts.skipped++;
        continue;
      }

      try {
        const result = reminder.type === "appointment_reminder"
          ? await processAppointment(supabase, reminder)
          : await processRecall(supabase, reminder);
        counts[result]++;
      } catch (error) {
        const result = await handleFailure(
          supabase,
          reminder,
          error instanceof Error ? error.message : "Reminder processing failed",
        );
        counts[result]++;
      }
    }

    return json({ processed: (data ?? []).length, ...counts });
  } catch (error) {
    console.error("process-reminders failed", error);
    return json({ error: "Reminder processing failed" }, 500);
  }
});
