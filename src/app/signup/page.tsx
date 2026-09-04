"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEPLOYMENT_BUSINESS_TYPE, BUSINESS_COPY } from "@/lib/businessType";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const copy = BUSINESS_COPY[DEPLOYMENT_BUSINESS_TYPE];
  const [role, setRole] = useState<"planner" | "supplier">("planner");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          full_name: fullName,
          business_name: businessName,
          business_type: DEPLOYMENT_BUSINESS_TYPE,
        },
      },
    });

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? "Could not create account.");
      setSubmitting(false);
      return;
    }

    // A database trigger provisions the profile (and planner/supplier record)
    // from the signup metadata as soon as the auth.users row is created.
    if (!data.session) {
      setNeedsConfirmation(true);
      setSubmitting(false);
      return;
    }

    router.push(`/${role}`);
    router.refresh();
  };

  if (needsConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-serif text-2xl mb-3">Check your email</h1>
          <p className="text-muted">
            We sent a confirmation link to {email}. Click it to activate your account, then
            sign in.
          </p>
          <Link href="/login" className="inline-block mt-6 text-terracotta font-medium">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-serif text-xl tracking-wide block text-center mb-10">
          {copy.siteName}
        </Link>
        <div className="bg-cream-light rounded-2xl border border-line p-8">
          <h1 className="font-serif text-2xl mb-2 text-center">Create your account</h1>
          <p className="text-sm text-muted text-center mb-6">
            Sell on the {copy.siteName} marketplace as a {copy.accountNoun} or a supplier.
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
                {r === "planner" ? copy.accountNoun : r}
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
              placeholder={role === "planner" ? "Business name" : "Company name"}
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
