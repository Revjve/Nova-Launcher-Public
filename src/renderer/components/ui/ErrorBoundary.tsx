import type { PropsWithChildren, ReactNode } from "react";
import { Component } from "react";
import { Card } from "./Card";

type ErrorBoundaryProps = PropsWithChildren<{
  fallback?: ReactNode;
}>;

type ErrorBoundaryState = {
  error?: Error;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Nova renderer crashed", error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="fixed inset-0 grid place-items-center bg-[var(--shell-bg)] px-6">
            <Card className="w-full max-w-2xl p-8">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-text)]">
                Renderer error
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Nova hit a UI error.</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--soft-text)]">
                {this.state.error.message}
              </p>
              <p className="mt-3 text-xs leading-6 text-[var(--muted-text)]">
                Open the launcher again after this fix if the message changes, or share the exact
                text and I will keep digging.
              </p>
            </Card>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
