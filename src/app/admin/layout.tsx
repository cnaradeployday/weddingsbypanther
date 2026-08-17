import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { BackofficeShell } from "@/components/BackofficeShell";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/approvals", label: "Approval queue" },
  { href: "/admin/suppliers", label: "Suppliers" },
  { href: "/admin/planners", label: "Planners" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/categories", label: "Categories" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin") redirect("/login");

  const supabase = await createClient();
  const { count: pending } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <BackofficeShell
      brand="BespokeWedding"
      subtitle="Marketplace admin"
      nav={NAV.map((n) =>
        n.href === "/admin/approvals" && pending
          ? { ...n, label: `${n.label} (${pending})` }
          : n
      )}
    >
      {children}
    </BackofficeShell>
  );
}
