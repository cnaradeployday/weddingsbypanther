import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { BackofficeShell } from "@/components/BackofficeShell";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/approvals", label: "Approval queue" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/suppliers", label: "Suppliers" },
  { href: "/admin/planners", label: "Planners" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/categories", label: "Categories" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin") redirect("/login");

  const supabase = await createClient();
  const [{ count: pendingProducts }, { count: pendingSuppliers }, { count: pendingPlanners }] =
    await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("planners").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

  const nav = NAV.map((n) => {
    if (n.href === "/admin/approvals" && pendingProducts) return { ...n, label: `${n.label} (${pendingProducts})` };
    if (n.href === "/admin/suppliers" && pendingSuppliers) return { ...n, label: `${n.label} (${pendingSuppliers})` };
    if (n.href === "/admin/planners" && pendingPlanners) return { ...n, label: `${n.label} (${pendingPlanners})` };
    return n;
  });

  return (
    <BackofficeShell brand="BespokeWedding" subtitle="Marketplace admin" nav={nav}>
      {children}
    </BackofficeShell>
  );
}
