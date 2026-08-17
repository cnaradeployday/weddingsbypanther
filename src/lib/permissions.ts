import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export const BACKOFFICE_SECTIONS = [
  "dashboard",
  "approvals",
  "products",
  "suppliers",
  "planners",
  "orders",
  "categories",
  "users",
  "roles",
] as const;

export type BackofficeSection = (typeof BACKOFFICE_SECTIONS)[number];

export const SECTION_LABEL: Record<BackofficeSection, string> = {
  dashboard: "Dashboard",
  approvals: "Approval queue",
  products: "Products",
  suppliers: "Suppliers",
  planners: "Planners",
  orders: "Orders",
  categories: "Categories",
  users: "Users",
  roles: "Roles & permissions",
};

export type Access = { read: boolean; write: boolean };
export type PermissionMap = Record<BackofficeSection, Access>;

function emptyMap(value: Access): PermissionMap {
  return Object.fromEntries(BACKOFFICE_SECTIONS.map((s) => [s, { ...value }])) as PermissionMap;
}

export async function getBackofficePermissions(
  supabase: SupabaseClient<Database>,
  profile: { role: string; role_id: string | null }
): Promise<PermissionMap> {
  if (profile.role === "admin") return emptyMap({ read: true, write: true });

  const perms = emptyMap({ read: false, write: false });
  if (!profile.role_id) return perms;

  const { data } = await supabase
    .from("role_permissions")
    .select("section, can_read, can_write")
    .eq("role_id", profile.role_id);

  for (const row of data ?? []) {
    if ((BACKOFFICE_SECTIONS as readonly string[]).includes(row.section)) {
      perms[row.section as BackofficeSection] = {
        read: row.can_read || row.can_write,
        write: row.can_write,
      };
    }
  }
  return perms;
}

export function hasAnyReadAccess(perms: PermissionMap): boolean {
  return Object.values(perms).some((p) => p.read);
}
