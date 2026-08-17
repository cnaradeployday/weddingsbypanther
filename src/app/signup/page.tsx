"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function slugify(input: string) {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "studio"}-${suffix}`;
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [role, setRole] = useState<"planner" | "supplier">("planner");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError || !data.user) {
      setError(signUpError?.message ?? "Could not create account.");
      setSubmitting(false);
      return;
    }

    const userId = data.user.id;

    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      role,
      full_name: fullName,
      email,
    });
    if (profileError) {
      setError(profileError.message);
      setSubmitting(false);
      return;
    }

    const slug = slugify(businessName);
    const { error: bizError } =
      role === "planner"
        ? await supabase
            .from("planners")
            .insert({ profile_id: userId, business_name: businessName, slug, tagline: "Wedding Studio" })
        : await supabase.from("suppliers").insert({ profile_id: userId, business_name: businessName, slug });
    if (bizError) {
      setError(bizError.message);
      setSubmitting(false);
      return;
    }

    router.push(`/${role}`);
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-serif text-xl tracking-wide block text-center mb-10">
          BESPOKE
        </Link>
        <div className="bg-cream-light rounded-2xl border border-line p-8">
          <h1 className="font-serif text-2xl mb-2 text-center">Create your account</h1>
          <p className="text-sm text-muted text-center mb-6">
            Sell on the Bespoke marketplace as a planner or a supplier.
          </p>

          <div className="flex rounded-full border border-line p-1 mb-6">
            {(["planner", "supplier"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 py-2 rounded-full text-sm capitalize ${
                  role === r ? "bg-dark text-cream-light" : "text-dark/70"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              required
              placeholder="Your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
            />
            <input
              required
              placeholder={role === "planner" ? "Studio name" : "Company name"}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
            />
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
            />
            {error && <p className="text-sm text-terracotta-dark">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>
          <p className="text-sm text-muted text-center mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-terracotta font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
