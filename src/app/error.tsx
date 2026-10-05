"use client";

import { useEffect } from "react";

// No error boundary existed anywhere under src/app — an uncaught render-time
// exception in any page (the product customizer included) crashed to the
// browser's own blank/unrecoverable error state instead of a page the
// customer could recover from with "Try again." This is the generic,
// catch-all one Next.js looks for at the root; a route can still add its
// own more specific error.tsx to override it.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <h1 className="font-serif text-2xl mb-2">Something went wrong</h1>
        <p className="text-sm text-muted mb-6">
          This page ran into an unexpected error. Your work in progress is saved automatically — try again, or reload
          the page.
        </p>
        <button
          type="button"
          onClick={reset}
          className="px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
