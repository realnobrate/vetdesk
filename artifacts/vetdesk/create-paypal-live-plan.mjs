async function main() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_SECRET?.trim();
  const paypalBaseUrl = (
    process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com"
  ).replace(/\/$/, "");

  if (!clientId || !clientSecret) {
    throw new Error(
      "Set PAYPAL_CLIENT_ID and PAYPAL_SECRET environment variables before running this one-time script.",
    );
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  console.log("\nDobijanje PayPal access tokena...");

  const tokenResponse = await fetch(
    `${paypalBaseUrl}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    },
  );

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.error(tokenData);
    throw new Error("Nije moguće dobiti PayPal access token.");
  }

  const accessToken = tokenData.access_token;

  console.log("Kreiranje VetDesk proizvoda...");

  const productResponse = await fetch(
    `${paypalBaseUrl}/v1/catalogs/products`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `vetdesk-product-${Date.now()}`,
      },
      body: JSON.stringify({
        name: "VetDesk Pro",
        description:
          "Complete veterinary clinic management software subscription.",
        type: "SERVICE",
        category: "SOFTWARE",
      }),
    },
  );

  const product = await productResponse.json();

  if (!productResponse.ok) {
    console.error(product);
    throw new Error("Nije moguće napraviti PayPal proizvod.");
  }

  console.log(`Proizvod napravljen: ${product.id}`);
  console.log("Kreiranje plana sa 14 dana besplatno...");

  const planResponse = await fetch(
    `${paypalBaseUrl}/v1/billing/plans`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `vetdesk-plan-${Date.now()}`,
      },
      body: JSON.stringify({
        product_id: product.id,
        name: "VetDesk Pro - 14 Day Free Trial",
        description:
          "14 days free, then 19 EUR per month until cancelled.",
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: {
              interval_unit: "DAY",
              interval_count: 14,
            },
            tenure_type: "TRIAL",
            sequence: 1,
            total_cycles: 1,
            pricing_scheme: {
              fixed_price: {
                value: "0",
                currency_code: "EUR",
              },
            },
          },
          {
            frequency: {
              interval_unit: "MONTH",
              interval_count: 1,
            },
            tenure_type: "REGULAR",
            sequence: 2,
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
    },
  );

  const plan = await planResponse.json();

  if (!planResponse.ok) {
    console.error(plan);
    throw new Error("Nije moguće napraviti PayPal plan.");
  }

  console.log("\nPlan je uspešno napravljen.");
  console.log(`Product ID: ${product.id}`);
  console.log(`Plan ID: ${plan.id}`);
  console.log("\nSačuvaj Plan ID. Počinje sa P-.");
}

main().catch((error) => {
  console.error("\nGreška:", error.message);
  process.exit(1);
});
