import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { BackofficeShell } from "@/components/BackofficeShell";

const NAV = [
  { href: "/supplier", label: "Overview" },
  { href: "/supplier/products", label: "My products" },
  { href: "/supplier/orders", label: "Orders to fulfil" },
  { href: "/supplier/payouts", label: "Payouts" },
];

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "supplier") redirect("/login");

  const supabase = await createClient();
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("profile_id", session.user.id)
    .maybeSingle();

  if (!supplier) redirect("/login");

  return (
    <BackofficeShell brand={supplier.business_name} subtitle="Supplier portal" nav={NAV}>
      {children}
    </BackofficeShell>
  );
}
