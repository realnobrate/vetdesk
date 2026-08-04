import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  escapeHtml,
  isEmail,
  sendWithResend,
} from "../_shared/email.ts";

const DEFAULT_ORIGIN = "https://vetdesk-gules.vercel.app";

function corsHeaders(req: Request): Record<string, string> {
  const allowedOrigins = (Deno.env.get("APP_ORIGINS") || DEFAULT_ORIGIN)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const requestOrigin = req.headers.get("origin");
  const allowedOrigin =
    requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { success: false, error: "Method not allowed" }, 405);
  }

  try {
    const authorization = req.headers.get("authorization");
    if (!authorization) {
      return json(req, { success: false, error: "Authentication required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return json(req, { success: false, error: "Invalid session" }, 401);
    }

    const body = await req.json();
    const clinicId = Number(body?.clinicId);
    const requestedEmail = String(body?.testEmail ?? "").trim().toLowerCase();
    if (!Number.isSafeInteger(clinicId) || clinicId <= 0) {
      return json(req, { success: false, error: "Invalid clinic" }, 400);
    }

    const { data: staff } = await adminClient
      .from("staff")
      .select("clinic_id, role, status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (
      !staff ||
      staff.clinic_id !== clinicId ||
      staff.role !== "admin" ||
      staff.status !== "active"
    ) {
      return json(req, { success: false, error: "Administrator access required" }, 403);
    }

    const { data: clinic, error: clinicError } = await adminClient
      .from("clinics")
      .select("id, name, email, email_sender_name, reply_to_email")
      .eq("id", clinicId)
      .single();
    if (clinicError || !clinic) {
      return json(req, { success: false, error: "Clinic not found" }, 404);
    }

    const recipient = requestedEmail || user.email?.toLowerCase() || "";
    if (!isEmail(recipient)) {
      return json(req, { success: false, error: "Enter a valid test email" }, 400);
    }

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await adminClient
      .from("sent_emails")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .is("notification_queue_id", null)
      .gte("sent_at", oneMinuteAgo);
    if ((count ?? 0) > 0) {
      return json(
        req,
        { success: false, error: "Wait one minute before sending another test" },
        429,
      );
    }

    const clinicName = escapeHtml(clinic.name);
    const recipientHtml = escapeHtml(recipient);
    const html = `<!doctype html>
      <html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
      <main style="max-width:600px;margin:0 auto;padding:24px">
      <h1 style="color:#0d4f6c">VetDesk email test</h1>
      <p>Email notifications for <strong>${clinicName}</strong> are configured.</p>
      <p>This test was sent to <strong>${recipientHtml}</strong>.</p>
      <p style="color:#6b7280;font-size:13px">No client or patient data is included in test messages.</p>
      </main></body></html>`;

    const result = await sendWithResend({
      to: recipient,
      fromName: clinic.email_sender_name || "VetDesk",
      replyTo: clinic.reply_to_email || undefined,
      subject: `VetDesk email test — ${clinic.name}`,
      html,
    });

    await adminClient.from("sent_emails").insert({
      clinic_id: clinicId,
      notification_queue_id: null,
      recipient_email: recipient,
      subject: `VetDesk email test — ${clinic.name}`,
      body: html,
      status: result.success ? "sent" : "failed",
      error_message: result.error ?? null,
    });

    if (!result.success) {
      return json(req, { success: false, error: result.error }, 502);
    }

    return json(req, { success: true, message: "Test email sent successfully" });
  } catch (error) {
    console.error("send-test-email failed", error);
    return json(req, { success: false, error: "Test email could not be sent" }, 500);
  }
});
