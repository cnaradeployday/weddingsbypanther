import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { getBackofficePermissions } from "@/lib/permissions";
import { NewUserForm } from "@/components/NewUserForm";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminUsersPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();
  const perms = await getBackofficePermissions(supabase, session.profile);

  const [{ data: profiles }, { data: planners }, { data: suppliers }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*, backoffice_role:roles(name)").order("created_at", { ascending: false }),
    supabase.from("planners").select("id, business_name, profile_id").not("profile_id", "is", null),
    supabase.from("suppliers").select("id, business_name, profile_id").not("profile_id", "is", null),
    supabase.from("roles").select("id, name").order("name"),
  ]);

  const plannerByProfile = new Map((planners ?? []).map((p) => [p.profile_id, p]));
  const supplierByProfile = new Map((suppliers ?? []).map((s) => [s.profile_id, s]));

  // last_sign_in_at lives on auth.users, not exposed via the normal client —
  // only the service-role admin client can read it.
  let lastSignInByProfile = new Map<string, string | null>();
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
    lastSignInByProfile = new Map((data?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY not configured — last login just won't show.
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl mb-1">Users</h1>
          <p className="text-muted">{profiles?.length ?? 0} accounts</p>
        </div>
        {perms.users.write && <NewUserForm roles={roles ?? []} />}
      </div>

      <div className="rounded-xl border border-line bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Backoffice role</th>
              <th className="px-5 py-3 font-medium">Planner</th>
              <th className="px-5 py-3 font-medium">Supplier</th>
              <th className="px-5 py-3 font-medium">Last login</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => {
              const planner = plannerByProfile.get(p.id);
              const supplier = supplierByProfile.get(p.id);
              const lastSignIn = lastSignInByProfile.get(p.id);
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
                  <td className="px-5 py-4 text-muted whitespace-nowrap">
                    {lastSignIn
                      ? new Date(lastSignIn).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Never"}
                  </td>
                  <td className="px-5 py-4">
                    {perms.users.write && (
                      <Link href={`/admin/users/${p.id}/edit`} className="text-terracotta text-sm font-medium">
                        Edit
                      </Link>
                    )}
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
