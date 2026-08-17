"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Minimal email+code login so a customer can come back later and check an
// order's status without ever setting a password. Supabase emails a 6-digit
// code (and a magic link) to the address on signInWithOtp; entering the
// code here verifies it and starts a real session, which the server page
// then picks up via router.refresh().
export function CustomerLoginOtp() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setStage("code");
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setLoading(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    router.refresh();
  };

  return (
    <div className="max-w-sm mx-auto rounded-2xl border border-line bg-white p-6 text-center">
      <h2 className="font-serif text-2xl mb-2">Track your order</h2>
      <p className="text-sm text-muted mb-6">
        Enter the email you used at checkout. We&apos;ll send a verification code — no password needed.
      </p>

      {stage === "email" ? (
        <form onSubmit={sendCode} className="space-y-3">
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
            disabled={loading}
            className="w-full px-6 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send verification code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-3">
          <p className="text-xs text-muted">
            We sent a 6-digit code to <span className="font-medium">{email}</span>.
          </p>
          <input
            required
            inputMode="numeric"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 text-center tracking-[0.3em] focus:outline-none focus:border-dark"
          />
          {error && <p className="text-sm text-terracotta-dark">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify & continue"}
          </button>
          <button
            type="button"
            onClick={() => setStage("email")}
            className="text-xs text-muted underline underline-offset-2"
          >
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
}
