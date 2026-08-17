"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
    });
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-serif text-xl tracking-wide block text-center mb-10">
          BESPOKE
        </Link>
        <div className="bg-cream-light rounded-2xl border border-line p-8">
          {!ready ? (
            <p className="text-sm text-muted text-center">
              This link may have expired. Request a new one from{" "}
              <Link href="/forgot-password" className="text-terracotta font-medium">
                forgot password
              </Link>
              .
            </p>
          ) : done ? (
            <p className="text-sm text-center">Password updated — redirecting to sign in…</p>
          ) : (
            <>
              <h1 className="font-serif text-2xl mb-6 text-center">Set a new password</h1>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  required
                  type="password"
                  placeholder="New password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
                />
                {error && <p className="text-sm text-terracotta-dark">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-6 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
