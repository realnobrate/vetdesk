import * as React from "react";
import {
  Switch,
  Route,
  Redirect,
  Router as WouterRouter,
} from "wouter";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";
import type { StaffRole } from "@/lib/types";

const Home = React.lazy(() => import("@/pages/home"));
const Dashboard = React.lazy(() => import("@/pages/dashboard"));
const OwnersList = React.lazy(() => import("@/pages/owners/index"));
const OwnerDetail = React.lazy(() => import("@/pages/owners/detail"));
const PetDetail = React.lazy(() => import("@/pages/pets/detail"));
const ClinicalRecord = React.lazy(() => import("@/pages/pets/clinical-record"));
const RecallsList = React.lazy(() => import("@/pages/recalls"));
const AppointmentsList = React.lazy(() => import("@/pages/appointments"));
const NotFound = React.lazy(() => import("@/pages/not-found"));
const SignInPage = React.lazy(() => import("@/pages/sign-in"));
const SignUpPage = React.lazy(() => import("@/pages/sign-up"));
const BillingPage = React.lazy(() => import("@/pages/billing"));
const ClinicSettings = React.lazy(() => import("@/pages/clinic-settings"));
const StaffPage = React.lazy(() => import("@/pages/staff"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function AuthenticatedRoute({
  component: Component,
  allowedRoles,
}: {
  component: React.ComponentType;
  allowedRoles?: StaffRole[];
}) {
  const {
    session,
    staff,
    loading,
    hasActiveSubscription,
    subscriptionLoading,
    accountError,
    subscriptionError,
    reloadAccount,
    refreshSubscription,
  } = useAuth();

  if (loading || subscriptionLoading) {
    return <FullPageSpinner />;
  }

  if (!session) {
    return <Redirect to="/sign-in" />;
  }

  if (accountError || !staff) {
    return (
      <AccessMessage
        title="Clinic account unavailable"
        description={
          accountError ?? "VetDesk could not find your staff profile."
        }
        actionLabel="Try again"
        onAction={() => void reloadAccount()}
      />
    );
  }

  if (staff.status !== "active") {
    return (
      <AccessMessage
        title={staff.status === "pending" ? "Access pending" : "Access inactive"}
        description={
          staff.status === "pending"
            ? "A clinic administrator needs to activate your staff account."
            : "Your clinic administrator has deactivated this staff account."
        }
      />
    );
  }

  if (subscriptionError) {
    return (
      <AccessMessage
        title="Subscription check unavailable"
        description={subscriptionError}
        actionLabel="Check again"
        onAction={() => void refreshSubscription()}
      />
    );
  }

  if (!hasActiveSubscription) {
    return <Redirect to="/billing" />;
  }

  if (allowedRoles && !allowedRoles.includes(staff.role)) {
    return (
      <AccessMessage
        title="Administrator access required"
        description="Your staff role does not allow access to this section."
      />
    );
  }

  return <Component />;
}

function AccessMessage({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
      <section className="w-full max-w-lg rounded-3xl border bg-card p-6 text-center shadow-sm">
        <img src="/logo.svg" alt="VetDesk" className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {actionLabel && onAction ? (
          <Button className="mt-5" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </section>
    </main>
  );
}

function BillingRoute() {
  const { session, staff, loading, accountError, reloadAccount } = useAuth();

  if (loading) {
    return <FullPageSpinner />;
  }

  if (!session) {
    return <Redirect to="/sign-in" />;
  }

  if (accountError || !staff) {
    return (
      <AccessMessage
        title="Clinic account unavailable"
        description={accountError ?? "VetDesk could not find your staff profile."}
        actionLabel="Try again"
        onAction={() => void reloadAccount()}
      />
    );
  }

  if (staff.status !== "active") {
    return (
      <AccessMessage
        title="Clinic access is not active"
        description="An active clinic staff account is required before billing can be changed."
      />
    );
  }

  if (staff.role !== "admin") {
    return (
      <AccessMessage
        title="Administrator access required"
        description="Only a clinic administrator can start or change the VetDesk subscription."
      />
    );
  }

  return <BillingPage />;
}

function HomeRedirect() {
  const {
    session,
    loading,
    hasActiveSubscription,
    subscriptionLoading,
  } = useAuth();

  if (loading || subscriptionLoading) {
    return <FullPageSpinner />;
  }

  if (!session) {
    return <Home />;
  }

  if (!hasActiveSubscription) {
    return <Redirect to="/billing" />;
  }

  return <Redirect to="/dashboard" />;
}

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="rounded-[24px] border border-border/70 bg-card/90 px-6 py-5 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-primary/15" />
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/">
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <HomeRedirect />
        </React.Suspense>
      </Route>

      <Route path="/sign-in">
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <SignInPage />
        </React.Suspense>
      </Route>

      <Route path="/sign-up">
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <SignUpPage />
        </React.Suspense>
      </Route>

      <Route path="/billing">
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <BillingRoute />
        </React.Suspense>
      </Route>

      <Route path="/dashboard">
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <AuthenticatedRoute component={Dashboard} />
        </React.Suspense>
      </Route>

      <Route path="/owners">
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <AuthenticatedRoute component={OwnersList} />
        </React.Suspense>
      </Route>

      <Route path="/owners/:id">
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <AuthenticatedRoute component={OwnerDetail} />
        </React.Suspense>
      </Route>

      <Route path="/pets/:id">
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <AuthenticatedRoute component={PetDetail} />
        </React.Suspense>
      </Route>

      <Route path="/pets/:id/clinical">
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <AuthenticatedRoute component={ClinicalRecord} />
        </React.Suspense>
      </Route>

      <Route path="/recalls">
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <AuthenticatedRoute component={RecallsList} />
        </React.Suspense>
      </Route>

      <Route path="/appointments">
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <AuthenticatedRoute component={AppointmentsList} />
        </React.Suspense>
      </Route>

      <Route path="/staff">
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <AuthenticatedRoute component={StaffPage} allowedRoles={["admin"]} />
        </React.Suspense>
      </Route>

      <Route path="/clinic-settings">
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <AuthenticatedRoute
            component={ClinicSettings}
            allowedRoles={["admin"]}
          />
        </React.Suspense>
      </Route>

      <Route>
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <NotFound />
        </React.Suspense>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <AuthProvider>
            <TooltipProvider>
              <AppRoutes />
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
