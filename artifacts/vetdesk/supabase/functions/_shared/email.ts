export interface OutgoingEmail {
  to: string;
  fromName: string;
  subject: string;
  html: string;
  replyTo?: string;
  idempotencyKey?: string;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function sendWithResend(
  email: OutgoingEmail,
): Promise<{ success: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const fromAddress =
    Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "onboarding@resend.dev";

  if (!apiKey) return { success: false, error: "Email service is not configured" };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (email.idempotencyKey) {
    headers["Idempotency-Key"] = email.idempotencyKey;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: `${email.fromName.replace(/[<>\r\n]/g, "").slice(0, 100)} <${fromAddress}>`,
      to: email.to,
      subject: email.subject,
      html: email.html,
      reply_to: email.replyTo,
    }),
  });

  if (response.ok) return { success: true };

  let message = `Email provider returned ${response.status}`;
  try {
    const body = await response.json();
    if (typeof body?.message === "string") message = body.message;
  } catch {
    // Keep the safe status-only message.
  }

  return { success: false, error: message.slice(0, 500) };
}
