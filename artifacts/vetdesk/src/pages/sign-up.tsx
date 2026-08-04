import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const [, setLocation] = useLocation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error, requiresEmailConfirmation } = await signUp(
      email.trim().toLowerCase(),
      password,
      name.trim(),
    );
    setLoading(false);
    if (error) {
      setError(error);
    } else if (requiresEmailConfirmation) {
      setConfirmationSent(true);
    } else {
      setLocation("/dashboard");
    }
  }

  if (confirmationSent) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
        <Card className="w-full max-w-[460px] border-border/70 text-center shadow-sm">
          <CardHeader>
            <img src="/logo.svg" alt="VetDesk" className="mx-auto h-12 w-12" />
            <CardTitle className="mt-3">Check your email</CardTitle>
            <CardDescription>
              We sent an account confirmation link to {email.trim()}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/sign-in")}>
              Continue to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,116,144,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(234,88,12,0.12),transparent_24%)]" />
      <div className="relative w-full max-w-[460px]">
        <Card className="w-full border-border/70 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)]">
          <CardHeader className="space-y-3 pb-4 text-center">
            <div className="flex justify-center">
              <img src="/logo.svg" alt="VetDesk logo" className="h-12 w-12" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Create your VetDesk account</CardTitle>
              <CardDescription>Set up your clinic's front desk in minutes</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Dr. Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="transition-all duration-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@clinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="transition-all duration-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="transition-all duration-200"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...</> : "Create Account"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <a
                href="/sign-in"
                className="font-semibold text-primary hover:underline"
                onClick={(e) => { e.preventDefault(); setLocation("/sign-in"); }}
              >
                Sign in
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
