"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-serif text-xl tracking-wide block text-center mb-10">
          BESPOKE
        </Link>
        <div className="bg-cream-light rounded-2xl border border-line p-8">
          {sent ? (
            <>
              <h1 className="font-serif text-2xl mb-3 text-center">Check your email</h1>
              <p className="text-sm text-muted text-center">
                If an account exists for {email}, we sent a link to reset your password.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-serif text-2xl mb-2 text-center">Reset your password</h1>
              <p className="text-sm text-muted text-center mb-6">
                We&apos;ll email you a link to set a new one.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  required
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
                />
                {error && <p className="text-sm text-terracotta-dark">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-6 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50"
                >
                  {submitting ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          )}
          <p className="text-sm text-muted text-center mt-6">
            <Link href="/login" className="text-terracotta font-medium">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
