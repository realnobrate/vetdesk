import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getOrCreateStaff } from "@/lib/api";
import type { Staff } from "@/lib/types";

type SubscriptionStatus =
  | "active"
  | "approval_pending"
  | "cancelled"
  | "suspended"
  | "expired"
  | "payment_failed"
  | "refunded"
  | "reversed"
  | null;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  staff: Staff | null;
  subscriptionStatus: SubscriptionStatus;
  hasActiveSubscription: boolean;
  loading: boolean;
  subscriptionLoading: boolean;
  refreshSubscription: () => Promise<void>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  const loadSubscription = useCallback(
    async (currentStaff: Staff | null) => {
      if (!currentStaff?.clinic_id) {
        setSubscriptionStatus(null);
        return;
      }

      setSubscriptionLoading(true);

      try {
        const { data, error } = await supabase
          .from("subscriptions")
          .select("status")
          .eq("clinic_id", currentStaff.clinic_id)
          .maybeSingle();

        if (error) {
          console.error("Failed to load subscription:", error);
          setSubscriptionStatus(null);
          return;
        }

        setSubscriptionStatus(
          (data?.status as SubscriptionStatus) ?? null,
        );
      } finally {
        setSubscriptionLoading(false);
      }
    },
    [],
  );

  const loadUserData = useCallback(
    async (currentSession: Session | null) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (!currentSession?.user) {
        setStaff(null);
        setSubscriptionStatus(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const currentStaff = await getOrCreateStaff();
        setStaff(currentStaff);
        await loadSubscription(currentStaff);
      } catch (error) {
        console.error("Failed to provision staff:", error);
        setStaff(null);
        setSubscriptionStatus(null);
      } finally {
        setLoading(false);
      }
    },
    [loadSubscription],
  );

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        void loadUserData(currentSession);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      void loadUserData(currentSession);
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  async function refreshSubscription(): Promise<void> {
    await loadSubscription(staff);
  }

  async function signIn(
    email: string,
    password: string,
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error?.message ?? null };
  }

  async function signUp(
    email: string,
    password: string,
    name: string,
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    return { error: error?.message ?? null };
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  const hasActiveSubscription = subscriptionStatus === "active";

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        staff,
        subscriptionStatus,
        hasActiveSubscription,
        loading,
        subscriptionLoading,
        refreshSubscription,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return ctx;
}