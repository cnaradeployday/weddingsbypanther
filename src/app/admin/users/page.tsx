import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";

export default async function AdminUsersPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const [{ data: profiles }, { data: planners }, { data: suppliers }] = await Promise.all([
    supabase.from("profiles").select("*, backoffice_role:roles(name)").order("created_at", { ascending: false }),
    supabase.from("planners").select("id, business_name, profile_id").not("profile_id", "is", null),
    supabase.from("suppliers").select("id, business_name, profile_id").not("profile_id", "is", null),
  ]);

  const plannerByProfile = new Map((planners ?? []).map((p) => [p.profile_id, p]));
  const supplierByProfile = new Map((suppliers ?? []).map((s) => [s.profile_id, s]));

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Users</h1>
      <p className="text-muted mb-8">{profiles?.length ?? 0} accounts</p>

      <div className="rounded-xl border border-line bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Backoffice role</th>
              <th className="px-5 py-3 font-medium">Planner</th>
              <th className="px-5 py-3 font-medium">Supplier</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => {
              const planner = plannerByProfile.get(p.id);
              const supplier = supplierByProfile.get(p.id);
              return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-4 font-medium">{p.full_name ?? "—"}</td>
                  <td className="px-5 py-4 text-muted">{p.email}</td>
                  <td className="px-5 py-4">
                    {p.role === "admin" ? (
                      <span className="text-xs bg-sage/15 text-sage px-2.5 py-1 rounded-full">Super Admin</span>
                    ) : p.backoffice_role ? (
                      <span className="text-xs bg-gold/20 text-dark px-2.5 py-1 rounded-full">
                        {p.backoffice_role.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">None</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-muted">{planner ? planner.business_name : "—"}</td>
                  <td className="px-5 py-4 text-muted">{supplier ? supplier.business_name : "—"}</td>
                  <td className="px-5 py-4">
                    <Link href={`/admin/users/${p.id}/edit`} className="text-terracotta text-sm font-medium">
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
