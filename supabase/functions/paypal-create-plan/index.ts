const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    console.error("PayPal token error:", data);
    throw new Error("Failed to create PayPal access token.");
  }

  return {
    accessToken: data.access_token as string,
    baseUrl,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    const { accessToken, baseUrl } = await getPayPalAccessToken();

    // 1. Kreiranje VetDesk proizvoda
    const productResponse = await fetch(baseUrl + "/v1/catalogs/products", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
        "PayPal-Request-Id": crypto.randomUUID(),
      },
      body: JSON.stringify({
        name: "VetDesk",
        description: "Veterinary clinic management software",
        type: "SERVICE",
        category: "SOFTWARE",
      }),
    });

    const product = await productResponse.json();

    if (!productResponse.ok) {
      console.error("PayPal product error:", product);
      throw new Error("Failed to create PayPal product.");
    }

    // 2. Kreiranje mesečnog plana
    const planResponse = await fetch(baseUrl + "/v1/billing/plans", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
        "PayPal-Request-Id": crypto.randomUUID(),
      },
      body: JSON.stringify({
        product_id: product.id,
        name: "VetDesk Pro Monthly",
        description: "VetDesk Pro monthly subscription",
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: {
              interval_unit: "MONTH",
              interval_count: 1,
            },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: "19.00",
                currency_code: "EUR",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: {
            value: "0",
            currency_code: "EUR",
          },
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
      }),
    });

    const plan = await planResponse.json();

    if (!planResponse.ok) {
      console.error("PayPal plan error:", plan);
      throw new Error("Failed to create PayPal subscription plan.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        product_id: product.id,
        plan_id: plan.id,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});