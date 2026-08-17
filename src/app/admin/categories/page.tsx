import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { CategoryManager } from "@/components/CategoryManager";

export default async function AdminCategoriesPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: categories } = await supabase.from("categories").select("*").order("sort_order");

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Categories</h1>
      <p className="text-muted mb-8">{categories?.length ?? 0} categories</p>
      <CategoryManager categories={categories ?? []} />
    </div>
  );
}
