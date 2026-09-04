import Link from "next/link";
import { BecomePlannerForm } from "@/components/BecomePlannerForm";
import { DEPLOYMENT_BUSINESS_TYPE, BUSINESS_COPY } from "@/lib/businessType";

export default function BecomeAPlannerPage() {
  const copy = BUSINESS_COPY[DEPLOYMENT_BUSINESS_TYPE];

  return (
    <div className="min-h-screen bg-cream px-6 py-16">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="font-serif text-xl tracking-wide block text-center mb-10">
          {copy.siteName}
        </Link>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta text-center mb-3">
          {copy.becomeAccountKicker}
        </p>
        <h1 className="font-serif text-3xl text-center mb-3">{copy.becomeAccountHeading}</h1>
        <p className="text-muted text-center mb-8 max-w-md mx-auto">{copy.becomeAccountBody}</p>
        <BecomePlannerForm businessType={DEPLOYMENT_BUSINESS_TYPE} />
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
