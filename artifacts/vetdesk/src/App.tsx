import * as React from "react";
import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";

const Home = React.lazy(() => import("@/pages/home"));
const Dashboard = React.lazy(() => import("@/pages/dashboard"));
const OwnersList = React.lazy(() => import("@/pages/owners/index"));
const OwnerDetail = React.lazy(() => import("@/pages/owners/detail"));
const PetDetail = React.lazy(() => import("@/pages/pets/detail"));
const RecallsList = React.lazy(() => import("@/pages/recalls"));
const AppointmentsList = React.lazy(() => import("@/pages/appointments"));
const NotFound = React.lazy(() => import("@/pages/not-found"));
const SignInPage = React.lazy(() => import("@/pages/sign-in"));
const SignUpPage = React.lazy(() => import("@/pages/sign-up"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AuthenticatedRoute({ component: Component }: { component: React.ComponentType }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!session) return <Redirect to="/sign-in" />;
  return <Component />;
}

function HomeRedirect() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Redirect to="/dashboard" />;
  return <Home />;
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
        <AuthProvider>
          <TooltipProvider>
            <AppRoutes />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
