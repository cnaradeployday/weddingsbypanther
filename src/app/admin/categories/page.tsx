import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { CategoryManager } from "@/components/CategoryManager";
import { getBackofficePermissions } from "@/lib/permissions";

export default async function AdminCategoriesPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();
  const perms = await getBackofficePermissions(supabase, session.profile);

  const { data: categories } = await supabase.from("categories").select("*").order("sort_order");
  const weddingCategories = (categories ?? []).filter((c) => c.business_type === "wedding");
  const merchandiseCategories = (categories ?? []).filter((c) => c.business_type === "merchandise");

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Categories</h1>
      <p className="text-muted mb-8">{categories?.length ?? 0} categories</p>

      <h2 className="text-lg font-medium mb-3">Wedding</h2>
      <div className="mb-10">
        <CategoryManager categories={weddingCategories} businessType="wedding" canWrite={perms.categories.write} />
      </div>

      <h2 className="text-lg font-medium mb-3">Merchandise</h2>
      <CategoryManager
        categories={merchandiseCategories}
        businessType="merchandise"
        canWrite={perms.categories.write}
      />
    </div>
  );
}
