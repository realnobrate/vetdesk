import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  getPayPalSubscription,
  mapPayPalStatus,
} from "../_shared/paypal.ts";

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

    const { data: staff, error: staffError } = await adminClient
      .from("staff")
      .select("clinic_id, role, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      staffError ||
      !staff?.clinic_id ||
      staff.status !== "active" ||
      staff.role !== "admin"
    ) {
      return json(req, { success: false, error: "Administrator access required" }, 403);
    }

    const requestBody = await req.json();
    const subscriptionId = String(requestBody?.subscription_id ?? "").trim();
    if (!/^I-[A-Z0-9]+$/i.test(subscriptionId)) {
      return json(req, { success: false, error: "Invalid PayPal subscription ID" }, 400);
    }

    const paypalSubscription = await getPayPalSubscription(subscriptionId);
    const expectedPlanId = Deno.env.get("PAYPAL_PLAN_ID")?.trim();
    if (!expectedPlanId || paypalSubscription.plan_id !== expectedPlanId) {
      return json(req, { success: false, error: "PayPal plan could not be verified" }, 400);
    }

    const { data: existingOwner } = await adminClient
      .from("subscriptions")
      .select("clinic_id")
      .eq("paypal_subscription_id", paypalSubscription.id)
      .maybeSingle();
    if (existingOwner && existingOwner.clinic_id !== staff.clinic_id) {
      return json(req, { success: false, error: "Subscription is already assigned" }, 409);
    }

    const { error: upsertError } = await adminClient
      .from("subscriptions")
      .upsert(
        {
          clinic_id: staff.clinic_id,
          paypal_subscription_id: paypalSubscription.id,
          plan_id: paypalSubscription.plan_id ?? null,
          payer_id: paypalSubscription.subscriber?.payer_id ?? null,
          status: mapPayPalStatus(paypalSubscription.status),
          current_period_start: paypalSubscription.start_time ?? null,
          current_period_end:
            paypalSubscription.billing_info?.next_billing_time ?? null,
        },
        { onConflict: "clinic_id" },
      );

    if (upsertError) throw upsertError;

    return json(req, {
      success: true,
      status: mapPayPalStatus(paypalSubscription.status),
    });
  } catch (error) {
    console.error("paypal-register-subscription failed", error);
    return json(req, { success: false, error: "Subscription verification failed" }, 500);
  }
});
