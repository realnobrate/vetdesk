import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { mapPayPalStatus, verifyPayPalWebhook } from "../_shared/paypal.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function subscriptionIdFromResource(resource: Record<string, unknown>): string | null {
  if (typeof resource.id === "string" && resource.id.startsWith("I-")) {
    return resource.id;
  }
  if (typeof resource.billing_agreement_id === "string") {
    return resource.billing_agreement_id;
  }

  const supplementary = resource.supplementary_data as
    | { related_ids?: { subscription_id?: string } }
    | undefined;
  return supplementary?.related_ids?.subscription_id ?? null;
}

function statusFromEvent(eventType: string, resourceStatus?: string): string | null {
  const explicit: Record<string, string> = {
    "BILLING.SUBSCRIPTION.ACTIVATED": "active",
    "BILLING.SUBSCRIPTION.SUSPENDED": "suspended",
    "BILLING.SUBSCRIPTION.CANCELLED": "cancelled",
    "BILLING.SUBSCRIPTION.EXPIRED": "expired",
    "BILLING.SUBSCRIPTION.PAYMENT.FAILED": "payment_failed",
    "PAYMENT.SALE.REFUNDED": "refunded",
    "PAYMENT.SALE.REVERSED": "reversed",
  };

  return explicit[eventType] ?? (resourceStatus ? mapPayPalStatus(resourceStatus) : null);
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let eventId: string | null = null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const event = (await req.json()) as Record<string, unknown>;
    const verified = await verifyPayPalWebhook(req.headers, event);
    if (!verified) return json({ error: "Invalid webhook signature" }, 401);

    eventId = typeof event.id === "string" ? event.id : null;
    const eventType = typeof event.event_type === "string" ? event.event_type : "unknown";
    const resource = (event.resource ?? {}) as Record<string, unknown>;
    if (!eventId) return json({ error: "Missing webhook event ID" }, 400);

    const { data: existing } = await supabase
      .from("paypal_webhook_events")
      .select("processed")
      .eq("event_id", eventId)
      .maybeSingle();
    if (existing?.processed) return json({ received: true, duplicate: true });

    const paypalSubscriptionId = subscriptionIdFromResource(resource);
    await supabase.from("paypal_webhook_events").upsert(
      {
        event_id: eventId,
        event_type: eventType,
        paypal_subscription_id: paypalSubscriptionId,
        processed: false,
        error_message: null,
      },
      { onConflict: "event_id" },
    );

    const nextStatus = statusFromEvent(
      eventType,
      typeof resource.status === "string" ? resource.status : undefined,
    );

    if (paypalSubscriptionId && nextStatus) {
      const { error: updateError } = await supabase
        .from("subscriptions")
        .update({ status: nextStatus })
        .eq("paypal_subscription_id", paypalSubscriptionId);
      if (updateError) throw updateError;
    }

    await supabase
      .from("paypal_webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("event_id", eventId);

    return json({ received: true });
  } catch (error) {
    console.error("paypal-webhook failed", error);
    if (eventId) {
      await supabase
        .from("paypal_webhook_events")
        .update({
          processed: false,
          error_message: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
        })
        .eq("event_id", eventId);
    }
    return json({ error: "Webhook processing failed" }, 500);
  }
});
