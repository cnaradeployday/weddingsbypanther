import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";

export default async function AdminPrintTechniquesPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: techniques } = await supabase
    .from("print_techniques")
    .select("*")
    .order("sort_order");

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl mb-1">Print techniques</h1>
          <p className="text-muted">
            {techniques?.length ?? 0} techniques available to suppliers and admins when configuring
            products.
          </p>
        </div>
        <Link
          href="/admin/print-techniques/new"
          className="px-5 py-2.5 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors"
        >
          New technique
        </Link>
      </div>

      <div className="grid gap-4">
        {(techniques ?? []).map((t) => (
          <Link
            key={t.id}
            href={`/admin/print-techniques/${t.id}/edit`}
            className="rounded-xl border border-line bg-white p-5 hover:border-dark/40 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium">{t.name}</p>
              <span className="text-xs text-terracotta">Edit →</span>
            </div>
            <p className="text-sm text-muted">{t.finish_description}</p>
          </Link>
        ))}
        {(!techniques || techniques.length === 0) && (
          <p className="text-muted">No print techniques yet — add one to get started.</p>
        )}
      </div>
    </div>
  );
}
