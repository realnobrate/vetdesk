export interface PayPalSubscription {
  id: string;
  plan_id?: string;
  status?: string;
  start_time?: string;
  billing_info?: {
    next_billing_time?: string;
  };
  subscriber?: {
    payer_id?: string;
  };
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function paypalBaseUrl(): string {
  return (
    Deno.env.get("PAYPAL_BASE_URL")?.trim() || "https://api-m.paypal.com"
  ).replace(/\/$/, "");
}

export async function getPayPalAccessToken(): Promise<string> {
  const clientId = requiredEnv("PAYPAL_CLIENT_ID");
  const secret =
  Deno.env.get("PAYPAL_SECRET")?.trim() ||
  requiredEnv("PAYPAL_CLIENT_SECRET");

  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error("PayPal authentication failed");
  }

  return body.access_token as string;
}

export async function getPayPalSubscription(
  subscriptionId: string,
): Promise<PayPalSubscription> {
  const token = await getPayPalAccessToken();
  const response = await fetch(
    `${paypalBaseUrl()}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("PayPal subscription could not be verified");
  }

  return (await response.json()) as PayPalSubscription;
}

export function mapPayPalStatus(status?: string): string {
  const normalized = status?.trim().toUpperCase();
  const statuses: Record<string, string> = {
    ACTIVE: "active",
    APPROVAL_PENDING: "approval_pending",
    APPROVED: "approval_pending",
    SUSPENDED: "suspended",
    CANCELLED: "cancelled",
    EXPIRED: "expired",
  };

  return statuses[normalized ?? ""] ?? "approval_pending";
}

export async function verifyPayPalWebhook(
  headers: Headers,
  event: Record<string, unknown>,
): Promise<boolean> {
  const token = await getPayPalAccessToken();
  const webhookId = requiredEnv("PAYPAL_WEBHOOK_ID");

  const verificationBody = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: event,
  };

  if (
    !verificationBody.auth_algo ||
    !verificationBody.cert_url ||
    !verificationBody.transmission_id ||
    !verificationBody.transmission_sig ||
    !verificationBody.transmission_time
  ) {
    return false;
  }

  const response = await fetch(
    `${paypalBaseUrl()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(verificationBody),
    },
  );

  if (!response.ok) return false;
  const body = await response.json();
  return body.verification_status === "SUCCESS";
}
