import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { BackofficeShell } from "@/components/BackofficeShell";

const NAV = [
  { href: "/planner", label: "Overview" },
  { href: "/planner/products", label: "Product catalog" },
  { href: "/planner/orders", label: "Orders" },
  { href: "/planner/proposals", label: "Proposals" },
  { href: "/planner/clients", label: "Clients" },
  { href: "/planner/settings", label: "Storefront" },
];

export default async function PlannerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const supabase = await createClient();
  const { data: planner } = await supabase
    .from("planners")
    .select("*")
    .eq("profile_id", session.user.id)
    .maybeSingle();

  if (!planner) redirect("/login");

  return (
    <BackofficeShell brand={planner.business_name} subtitle="Planner workspace" nav={NAV}>
      {children}
    </BackofficeShell>
  );
}
