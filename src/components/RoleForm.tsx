"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BACKOFFICE_SECTIONS, SECTION_LABEL, type BackofficeSection } from "@/lib/permissions";

export type InitialRole = {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<BackofficeSection, { read: boolean; write: boolean }>;
};

function emptyPerms(): Record<BackofficeSection, { read: boolean; write: boolean }> {
  return Object.fromEntries(
    BACKOFFICE_SECTIONS.map((s) => [s, { read: false, write: false }])
  ) as Record<BackofficeSection, { read: boolean; write: boolean }>;
}

export function RoleForm({ initial }: { initial?: InitialRole }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [perms, setPerms] = useState(initial?.permissions ?? emptyPerms());
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (section: BackofficeSection, mode: "read" | "write") => {
    setPerms((prev) => {
      const next = { ...prev[section] };
      next[mode] = !next[mode];
      if (mode === "write" && next.write) next.read = true;
      if (mode === "read" && !next.read) next.write = false;
      return { ...prev, [section]: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let roleId = initial?.id ?? "";

    if (initial) {
      const { error: updateError } = await supabase
        .from("roles")
        .update({ name, description: description || null })
        .eq("id", roleId);
      if (updateError) {
        setError(updateError.message);
        setSubmitting(false);
        return;
      }
      await supabase.from("role_permissions").delete().eq("role_id", roleId);
    } else {
      const { data: role, error: createError } = await supabase
        .from("roles")
        .insert({ name, description: description || null })
        .select()
        .single();
      if (createError || !role) {
        setError(createError?.message ?? "Could not create role.");
        setSubmitting(false);
        return;
      }
      roleId = role.id;
    }

    const rows = BACKOFFICE_SECTIONS.filter((s) => perms[s].read || perms[s].write).map((s) => ({
      role_id: roleId,
      section: s,
      can_read: perms[s].read || perms[s].write,
      can_write: perms[s].write,
    }));
    if (rows.length > 0) {
      await supabase.from("role_permissions").insert(rows);
    }

    router.push("/admin/roles");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!initial) return;
    if (!confirm(`Delete role "${initial.name}"? Anyone assigned to it will lose backoffice access.`)) return;
    setDeleting(true);
    await supabase.from("roles").delete().eq("id", initial.id);
    router.push("/admin/roles");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="rounded-xl border border-line bg-white p-6 space-y-4">
        <input
          required
          placeholder="Role name (e.g. Catalog Manager)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
        />
        <input
          placeholder="Description"
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
        />
      </div>

      <div className="rounded-xl border border-line bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Section</th>
              <th className="px-5 py-3 font-medium text-center">Read</th>
              <th className="px-5 py-3 font-medium text-center">Write</th>
            </tr>
          </thead>
          <tbody>
            {BACKOFFICE_SECTIONS.map((s) => (
              <tr key={s} className="border-b border-line last:border-0">
                <td className="px-5 py-3">{SECTION_LABEL[s]}</td>
                <td className="px-5 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={perms[s].read}
                    onChange={() => toggle(s, "read")}
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-5 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={perms[s].write}
                    onChange={() => toggle(s, "write")}
                    className="h-4 w-4"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-terracotta-dark">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50"
        >
          {submitting ? "Saving…" : initial ? "Save changes" : "Create role"}
        </button>
        {initial && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-terracotta-dark disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete role"}
          </button>
        )}
      </div>
    </form>
  );
}
