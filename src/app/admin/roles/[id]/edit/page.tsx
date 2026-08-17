import { notFound, redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { RoleForm, type InitialRole } from "@/components/RoleForm";
import { BACKOFFICE_SECTIONS, type BackofficeSection } from "@/lib/permissions";

export default async function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: role } = await supabase
    .from("roles")
    .select("*, permissions:role_permissions(section, can_read, can_write)")
    .eq("id", id)
    .maybeSingle();

  if (!role) notFound();

  const permissions = Object.fromEntries(
    BACKOFFICE_SECTIONS.map((s) => [s, { read: false, write: false }])
  ) as Record<BackofficeSection, { read: boolean; write: boolean }>;

  for (const p of role.permissions ?? []) {
    if ((BACKOFFICE_SECTIONS as readonly string[]).includes(p.section)) {
      permissions[p.section as BackofficeSection] = { read: p.can_read, write: p.can_write };
    }
  }

  const initial: InitialRole = {
    id: role.id,
    name: role.name,
    description: role.description,
    permissions,
  };

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">{role.name}</h1>
      <p className="text-muted mb-8">Edit this role&apos;s section access.</p>
      <RoleForm initial={initial} />
    </div>
  );
}
