"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    await supabase.from("profiles").update({ must_change_password: false }).eq("id", userData.user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, role_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profile?.role === "admin" || profile?.role_id) {
      router.push("/admin");
    } else {
      const [{ data: planner }, { data: supplier }] = await Promise.all([
        supabase.from("planners").select("id").eq("profile_id", userData.user.id).maybeSingle(),
        supabase.from("suppliers").select("id").eq("profile_id", userData.user.id).maybeSingle(),
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
        <p className="font-serif text-xl tracking-wide text-center mb-10">BESPOKE</p>
        <div className="bg-cream-light rounded-2xl border border-line p-8">
          <h1 className="font-serif text-2xl mb-2 text-center">Set your password</h1>
          <p className="text-sm text-muted text-center mb-6">
            You&apos;re signing in with a temporary password. Choose a new one to continue.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              required
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
            />
            <input
              required
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
            />
            {error && <p className="text-sm text-terracotta-dark">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-6 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save and continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
