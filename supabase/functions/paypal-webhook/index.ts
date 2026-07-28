import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type PayPalEvent = {
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    billing_agreement_id?: string;
    billing_info?: {
      next_billing_time?: string;
    };
  };
};

async function getPayPalAccessToken() {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  const baseUrl = Deno.env.get("PAYPAL_BASE_URL");

  if (!clientId || !clientSecret || !baseUrl) {
    throw new Error("Missing PayPal environment variables.");
  }

  const credentials = btoa(clientId + ":" + clientSecret);

  const response = await fetch(baseUrl + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + credentials,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("PayPal access token error:", data);
    throw new Error("Failed to get PayPal access token.");
  }

  return {
    accessToken: data.access_token as string,
    baseUrl,
  };
}

function getStatusFromEvent(event: PayPalEvent) {
  switch (event.event_type) {
    case "BILLING.SUBSCRIPTION.CREATED":
      return "approval_pending";

    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "PAYMENT.SALE.COMPLETED":
      return "active";

    case "BILLING.SUBSCRIPTION.CANCELLED":
      return "cancelled";

    case "BILLING.SUBSCRIPTION.SUSPENDED":
      return "suspended";

    case "BILLING.SUBSCRIPTION.EXPIRED":
      return "expired";

    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
      return "payment_failed";

    case "PAYMENT.SALE.REFUNDED":
      return "refunded";

    case "PAYMENT.SALE.REVERSED":
      return "reversed";

    case "BILLING.SUBSCRIPTION.UPDATED":
      return event.resource?.status?.toLowerCase() ?? null;

    default:
      return null;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { success: false, error: "Method not allowed." },
        { status: 405 },
      );
    }

    const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");

    if (!webhookId) {
      throw new Error("Missing PAYPAL_WEBHOOK_ID.");
    }

    const event = (await req.json()) as PayPalEvent;

    const transmissionId = req.headers.get("paypal-transmission-id");
    const transmissionTime = req.headers.get("paypal-transmission-time");
    const transmissionSignature = req.headers.get("paypal-transmission-sig");
    const certUrl = req.headers.get("paypal-cert-url");
    const authAlgorithm = req.headers.get("paypal-auth-algo");

    if (
      !transmissionId ||
      !transmissionTime ||
      !transmissionSignature ||
      !certUrl ||
      !authAlgorithm
    ) {
      return Response.json(
        { success: false, error: "Missing PayPal verification headers." },
        { status: 400 },
      );
    }

    const { accessToken, baseUrl } = await getPayPalAccessToken();

    const verificationResponse = await fetch(
      baseUrl + "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transmission_id: transmissionId,
          transmission_time: transmissionTime,
          cert_url: certUrl,
          auth_algo: authAlgorithm,
          transmission_sig: transmissionSignature,
          webhook_id: webhookId,
          webhook_event: event,
        }),
      },
    );

    const verification = await verificationResponse.json();

    if (
      !verificationResponse.ok ||
      verification.verification_status !== "SUCCESS"
    ) {
      console.error("Webhook verification failed:", verification);

      return Response.json(
        { success: false, error: "Invalid PayPal webhook signature." },
        { status: 401 },
      );
    }

    const subscriptionId =
      event.resource?.billing_agreement_id ?? event.resource?.id;

    const status = getStatusFromEvent(event);

    if (!subscriptionId || !status) {
      return Response.json({
        success: true,
        ignored: true,
        event_type: event.event_type,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase server environment variables.");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const updateData: Record<string, string | null> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (event.resource?.billing_info?.next_billing_time) {
      updateData.current_period_end =
        event.resource.billing_info.next_billing_time;
    }

    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update(updateData)
      .eq("paypal_subscription_id", subscriptionId);

    if (error) {
      console.error("Webhook database update error:", error);

      return Response.json(
        { success: false, error: "Failed to update subscription." },
        { status: 500 },
      );
    }

    return Response.json({
      success: true,
      subscription_id: subscriptionId,
      status,
      event_type: event.event_type,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown server error.",
      },
      { status: 500 },
    );
  }
});