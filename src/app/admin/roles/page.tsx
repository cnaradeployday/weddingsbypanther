import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { SECTION_LABEL, type BackofficeSection } from "@/lib/permissions";

export default async function AdminRolesPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: roles } = await supabase
    .from("roles")
    .select("*, permissions:role_permissions(section, can_read, can_write)")
    .order("name");

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl mb-1">Roles & permissions</h1>
          <p className="text-muted">
            {roles?.length ?? 0} custom roles. &quot;Super Admin&quot; accounts always have full
            access regardless of these.
          </p>
        </div>
        <Link
          href="/admin/roles/new"
          className="px-5 py-2.5 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors"
        >
          New role
        </Link>
      </div>

      <div className="grid gap-4">
        {(roles ?? []).map((role) => {
          const sections = (role.permissions ?? [])
            .filter((p) => p.can_read || p.can_write)
            .map((p) => `${SECTION_LABEL[p.section as BackofficeSection] ?? p.section}${p.can_write ? "" : " (read-only)"}`);
          return (
            <Link
              key={role.id}
              href={`/admin/roles/${role.id}/edit`}
              className="rounded-xl border border-line bg-white p-5 hover:border-dark/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium">{role.name}</p>
                <span className="text-xs text-terracotta">Edit →</span>
              </div>
              {role.description && <p className="text-sm text-muted mb-2">{role.description}</p>}
              <p className="text-xs text-muted">
                {sections.length > 0 ? sections.join(" · ") : "No sections granted yet"}
              </p>
            </Link>
          );
        })}
        {(!roles || roles.length === 0) && (
          <p className="text-muted">No custom roles yet — create one to get started.</p>
        )}
      </div>
    </div>
  );
}
