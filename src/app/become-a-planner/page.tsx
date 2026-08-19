import Link from "next/link";
import { BecomePlannerForm } from "@/components/BecomePlannerForm";

export default function BecomeAPlannerPage() {
  return (
    <div className="min-h-screen bg-cream px-6 py-16">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="font-serif text-xl tracking-wide block text-center mb-10">
          BESPOKE
        </Link>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta text-center mb-3">
          For Wedding Planners
        </p>
        <h1 className="font-serif text-3xl text-center mb-3">Become a Planner</h1>
        <p className="text-muted text-center mb-8 max-w-md mx-auto">
          Open a branded shop on your own subdomain, pick which products to carry, and set your
          own markup. Tell us a bit about your business and our team will follow up.
        </p>
        <BecomePlannerForm />
        <p className="text-sm text-muted text-center mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-terracotta font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
