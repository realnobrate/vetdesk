-- Reproducible PayPal subscription state and webhook idempotency.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id bigserial PRIMARY KEY,
  clinic_id bigint NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  paypal_subscription_id text NOT NULL,
  status text NOT NULL DEFAULT 'approval_pending',
  plan_id text,
  payer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paypal_subscription_id text,
  ADD COLUMN IF NOT EXISTS plan_id text,
  ADD COLUMN IF NOT EXISTS payer_id text,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.subscriptions SET status = lower(status) WHERE status IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_clinic_unique
  ON public.subscriptions(clinic_id);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_paypal_id_unique
  ON public.subscriptions(paypal_subscription_id)
  WHERE paypal_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.paypal_webhook_events (
  id bigserial PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  paypal_subscription_id text,
  processed boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paypal_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_read_own ON public.subscriptions;
CREATE POLICY subscriptions_read_own ON public.subscriptions
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_staff_clinic_id());

DROP TRIGGER IF EXISTS subscriptions_updated_at_trigger ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at_trigger
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE ALL ON public.paypal_webhook_events FROM anon, authenticated;
