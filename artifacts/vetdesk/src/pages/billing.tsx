import { useState } from "react";
import {
  PayPalButtons,
  PayPalScriptProvider,
} from "@paypal/react-paypal-js";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
const paypalPlanId = import.meta.env.VITE_PAYPAL_PLAN_ID;

export default function BillingPage() {
  const [, setLocation] = useLocation();
  const {
    refreshSubscription,
    hasActiveSubscription,
    subscriptionStatus,
  } = useAuth();

  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (hasActiveSubscription) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
        <section className="w-full max-w-xl rounded-3xl border bg-card p-6 text-center shadow-sm sm:p-8">
          <img src="/logo.svg" alt="VetDesk" className="mx-auto h-12 w-12" />
          <h1 className="mt-4 text-2xl font-bold">VetDesk Pro is active</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This clinic has an active subscription. Billing changes and
            cancellation are managed through the PayPal account used at
            checkout.
          </p>
          <Button className="mt-5" onClick={() => setLocation("/dashboard")}>
            Return to dashboard
          </Button>
        </section>
      </main>
    );
  }

  if (!paypalClientId || !paypalPlanId) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Billing</h1>

          <p className="mt-3 text-destructive">
            PayPal konfiguracija nedostaje.
          </p>

          <p className="mt-2 text-sm text-muted-foreground">
            Proveri VITE_PAYPAL_CLIENT_ID i VITE_PAYPAL_PLAN_ID u .env fajlu.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId: paypalClientId,
        currency: "EUR",
        intent: "subscription",
        vault: true,
      }}
    >
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">VetDesk Billing</h1>

            <p className="mt-2 text-muted-foreground">
              Manage your VetDesk subscription.
            </p>
            {subscriptionStatus ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Current status: {subscriptionStatus.replace("_", " ")}
              </p>
            ) : null}
          </div>

          <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-primary">
                  VetDesk Pro
                </p>

                <div className="mt-2 flex items-end gap-2">
                  <span className="text-4xl font-bold">19 €</span>

                  <span className="pb-1 text-muted-foreground">
                    / month
                  </span>
                </div>

                <p className="mt-4 max-w-md text-sm text-muted-foreground">
                  Complete veterinary clinic management with owners, pets,
                  appointments, recalls and staff management.
                </p>

                <ul className="mt-5 space-y-2 text-sm">
                  <li>✓ Unlimited owners and pets</li>
                  <li>✓ Appointment management</li>
                  <li>✓ Recalls and visit tracking</li>
                  <li>✓ Staff management</li>
                  <li>✓ Secure cloud access</li>
                </ul>
              </div>

              <div className="w-full md:max-w-sm">
                {!subscriptionId ? (
                  <>
                    <PayPalButtons
                      disabled={isProcessing}
                      style={{
                        layout: "vertical",
                        shape: "rect",
                        label: "subscribe",
                      }}
                      createSubscription={(_data, actions) => {
                        setErrorMessage(null);

                        return actions.subscription.create({
                          plan_id: paypalPlanId,
                        });
                      }}
                      onApprove={async (data) => {
                        const newSubscriptionId = data.subscriptionID;

                        if (!newSubscriptionId) {
                          setErrorMessage(
                            "PayPal nije vratio subscription ID.",
                          );
                          return;
                        }

                        setIsProcessing(true);
                        setErrorMessage(null);

                        const { data: result, error } =
                          await supabase.functions.invoke(
                            "paypal-register-subscription",
                            {
                              body: {
                                subscription_id: newSubscriptionId,
                              },
                            },
                          );

                        setIsProcessing(false);

                        if (error) {
                          console.error(error);

                          setErrorMessage(
                            "Pretplata je odobrena u PayPal-u, ali nije sačuvana u VetDesk-u.",
                          );
                          return;
                        }

                        if (!result?.success) {
                          setErrorMessage(
                            result?.error ??
                              "Pretplata nije mogla da se potvrdi.",
                          );
                          return;
                        }

                        setSubscriptionId(newSubscriptionId);

                        await refreshSubscription();

                        setTimeout(() => {
                          setLocation("/dashboard");
                        }, 800);
                      }}
                      onError={() => {
                        setIsProcessing(false);
                        setErrorMessage(
                          "PayPal checkout could not be completed. No VetDesk subscription was activated.",
                        );
                      }}
                    />
                  </>
                ) : (
                  <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
                    <h2 className="font-semibold text-green-700">
                      Subscription approved
                    </h2>

                    <p className="mt-2 text-sm">
                      PayPal subscription ID:
                    </p>

                    <p className="mt-1 break-all font-mono text-xs">
                      {subscriptionId}
                    </p>

                    <p className="mt-3 text-sm text-muted-foreground">
                      Pretplata je uspešno aktivirana. Preusmeravanje na
                      Dashboard...
                    </p>
                  </div>
                )}

                {errorMessage && (
                  <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {errorMessage}
                  </div>
                )}

                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Start with a 14-day free trial.
                  Then 19€/month.
                  Cancel anytime through PayPal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PayPalScriptProvider>
  );
}
