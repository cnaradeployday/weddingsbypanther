import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { BackofficeShell } from "@/components/BackofficeShell";
import { getBackofficePermissions, hasAnyReadAccess, type BackofficeSection } from "@/lib/permissions";
import { DEPLOYMENT_BUSINESS_TYPE } from "@/lib/businessType";

const NAV: { href: string; label: string; section: BackofficeSection }[] = [
  { href: "/admin", label: "Dashboard", section: "dashboard" },
  { href: "/admin/approvals", label: "Approval queue", section: "approvals" },
  { href: "/admin/products", label: "Products", section: "products" },
  { href: "/admin/print-techniques", label: "Print techniques", section: "products" },
  { href: "/admin/suppliers", label: "Suppliers", section: "suppliers" },
  { href: "/admin/planners", label: "Planners", section: "planners" },
  { href: "/admin/merchandise", label: "Merchandise", section: "planners" },
  { href: "/admin/merchandise/products", label: "Merchandise products", section: "products" },
  { href: "/admin/planner-leads", label: "Planner leads", section: "planners" },
  { href: "/admin/orders", label: "Orders", section: "orders" },
  { href: "/admin/quote-requests", label: "Quote requests", section: "orders" },
  { href: "/admin/categories", label: "Categories", section: "categories" },
  { href: "/admin/users", label: "Users", section: "users" },
  { href: "/admin/roles", label: "Roles & permissions", section: "roles" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.profile.must_change_password) redirect("/change-password");

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

  const [
    { count: pendingProducts },
    { count: pendingSuppliers },
    { count: pendingPlanners },
    { count: pendingMerchandise },
    { count: newLeads },
    { count: newQuoteRequests },
  ] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("planners")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("business_type", "wedding"),
    supabase
      .from("planners")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("business_type", "merchandise"),
    supabase.from("planner_leads").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  const nav = NAV.filter((n) => perms[n.section].read).map((n) => {
    if (n.href === "/admin/approvals" && pendingProducts) return { ...n, label: `${n.label} (${pendingProducts})` };
    if (n.href === "/admin/suppliers" && pendingSuppliers) return { ...n, label: `${n.label} (${pendingSuppliers})` };
    if (n.href === "/admin/planners" && pendingPlanners) return { ...n, label: `${n.label} (${pendingPlanners})` };
    if (n.href === "/admin/merchandise" && pendingMerchandise)
      return { ...n, label: `${n.label} (${pendingMerchandise})` };
    if (n.href === "/admin/planner-leads" && newLeads) return { ...n, label: `${n.label} (${newLeads})` };
    if (n.href === "/admin/quote-requests" && newQuoteRequests)
      return { ...n, label: `${n.label} (${newQuoteRequests})` };
    return n;
  });

  const brand = DEPLOYMENT_BUSINESS_TYPE === "merchandise" ? "Merchandise" : "BespokeWedding";

  return (
    <BackofficeShell brand={brand} subtitle="Marketplace admin" nav={nav}>
      {children}
    </BackofficeShell>
  );
}
