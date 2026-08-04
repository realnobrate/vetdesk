import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled VetDesk UI error", { error, info });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
        <section className="w-full max-w-lg rounded-3xl border bg-card p-6 text-center shadow-sm">
          <img
            src="/logo.svg"
            alt="VetDesk"
            className="mx-auto h-12 w-12"
          />
          <h1 className="mt-4 text-2xl font-bold">VetDesk needs a refresh</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An unexpected screen error occurred. Your saved clinic data was not
            removed.
          </p>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            Reload application
          </Button>
        </section>
      </main>
    );
  }
}
