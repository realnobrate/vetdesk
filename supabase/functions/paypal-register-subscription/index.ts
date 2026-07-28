import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

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
    console.error("PayPal token error:", data);
    throw new Error("Failed to get PayPal access token.");
  }

  return {
    accessToken: data.access_token as string,
    baseUrl,
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      if (req.method !== "POST") {
        return Response.json(
          { success: false, error: "Method not allowed." },
          { status: 405 },
        );
      }

      const body = await req.json();
      const subscriptionId = body.subscription_id;

      if (
        typeof subscriptionId !== "string" ||
        !subscriptionId.startsWith("I-")
      ) {
        return Response.json(
          { success: false, error: "Invalid subscription ID." },
          { status: 400 },
        );
      }

      const userId = ctx.userClaims?.id;

      if (!userId) {
        return Response.json(
          { success: false, error: "Authenticated user not found." },
          { status: 401 },
        );
      }

      const { accessToken, baseUrl } = await getPayPalAccessToken();

      const paypalResponse = await fetch(
        baseUrl + "/v1/billing/subscriptions/" + subscriptionId,
        {
          method: "GET",
          headers: {
            Authorization: "Bearer " + accessToken,
            "Content-Type": "application/json",
          },
        },
      );

      const paypalSubscription = await paypalResponse.json();

      if (!paypalResponse.ok) {
        console.error("PayPal subscription error:", paypalSubscription);

        return Response.json(
          {
            success: false,
            error: "PayPal subscription could not be verified.",
          },
          { status: 400 },
        );
      }

      if (
        paypalSubscription.status !== "ACTIVE" &&
        paypalSubscription.status !== "APPROVAL_PENDING"
      ) {
        return Response.json(
          {
            success: false,
            error:
              "PayPal subscription is not active. Status: " +
              paypalSubscription.status,
          },
          { status: 400 },
        );
      }

      const { data: staff, error: staffError } = await ctx.supabaseAdmin
        .from("staff")
        .select("clinic_id")
        .eq("user_id", userId)
        .single();

      if (staffError || !staff?.clinic_id) {
        console.error("Staff lookup error:", staffError);

        return Response.json(
          {
            success: false,
            error: "Your account is not connected to a clinic.",
          },
          { status: 400 },
        );
      }

      const normalizedStatus =
        paypalSubscription.status === "ACTIVE"
          ? "active"
          : "approval_pending";

      const { error: upsertError } = await ctx.supabaseAdmin
        .from("subscriptions")
        .upsert(
          {
            clinic_id: staff.clinic_id,
            paypal_subscription_id: subscriptionId,
            paypal_plan_id: paypalSubscription.plan_id,
            status: normalizedStatus,
            current_period_end:
              paypalSubscription.billing_info?.next_billing_time ?? null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "clinic_id",
          },
        );

      if (upsertError) {
        console.error("Subscription upsert error:", upsertError);

        return Response.json(
          {
            success: false,
            error: "Failed to save subscription in VetDesk.",
          },
          { status: 500 },
        );
      }

      return Response.json({
        success: true,
        subscription_id: subscriptionId,
        status: normalizedStatus,
        clinic_id: staff.clinic_id,
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
  }),
};