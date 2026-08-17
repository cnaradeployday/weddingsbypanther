import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { BackofficeShell } from "@/components/BackofficeShell";
import { getBackofficePermissions, hasAnyReadAccess, type BackofficeSection } from "@/lib/permissions";

const NAV: { href: string; label: string; section: BackofficeSection }[] = [
  { href: "/admin", label: "Dashboard", section: "dashboard" },
  { href: "/admin/approvals", label: "Approval queue", section: "approvals" },
  { href: "/admin/products", label: "Products", section: "products" },
  { href: "/admin/suppliers", label: "Suppliers", section: "suppliers" },
  { href: "/admin/planners", label: "Planners", section: "planners" },
  { href: "/admin/orders", label: "Orders", section: "orders" },
  { href: "/admin/categories", label: "Categories", section: "categories" },
  { href: "/admin/users", label: "Users", section: "users" },
  { href: "/admin/roles", label: "Roles & permissions", section: "roles" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const supabase = await createClient();
  const perms = await getBackofficePermissions(supabase, session.profile);

  if (!hasAnyReadAccess(perms)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-serif text-2xl mb-3">No backoffice access</h1>
          <p className="text-muted text-sm">
            Your account isn&apos;t assigned a role with access to any section yet. Ask a Bespoke
            admin to grant you one from Users.
          </p>
        </div>
      </div>
    );
  }

  const [{ count: pendingProducts }, { count: pendingSuppliers }, { count: pendingPlanners }] =
    await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("planners").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

  const nav = NAV.filter((n) => perms[n.section].read).map((n) => {
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
