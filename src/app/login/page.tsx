"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEPLOYMENT_BUSINESS_TYPE, BUSINESS_COPY } from "@/lib/businessType";

export default function LoginPage() {
  const siteName = BUSINESS_COPY[DEPLOYMENT_BUSINESS_TYPE].siteName;
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.user) {
      setError(signInError?.message ?? "Could not sign in.");
      setSubmitting(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, role_id, must_change_password")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile?.must_change_password) {
      router.push("/change-password");
      router.refresh();
      return;
    }

    if (profile?.role === "admin" || profile?.role_id) {
      router.push("/admin");
    } else {
      const [{ data: planner }, { data: supplier }] = await Promise.all([
        supabase.from("planners").select("id").eq("profile_id", data.user.id).maybeSingle(),
        supabase.from("suppliers").select("id").eq("profile_id", data.user.id).maybeSingle(),
      ]);
      if (planner) router.push("/planner");
      else if (supplier) router.push("/supplier");
      else router.push("/");
    }
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-serif text-xl tracking-wide block text-center mb-10">
          {siteName}
        </Link>
        <div className="bg-cream-light rounded-2xl border border-line p-8">
          <h1 className="font-serif text-2xl mb-6 text-center">Sign in</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
            />
            <input
              required
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
            />
            <div className="text-right -mt-2">
              <Link href="/forgot-password" className="text-xs text-muted hover:text-terracotta">
                Forgot your password?
              </Link>
            </div>
            {error && <p className="text-sm text-terracotta-dark">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-6 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="text-sm text-muted text-center mt-6">
            No account yet?{" "}
            <Link href="/signup" className="text-terracotta font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
