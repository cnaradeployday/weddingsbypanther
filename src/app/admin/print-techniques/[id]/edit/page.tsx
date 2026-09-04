import { notFound, redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { PrintTechniqueForm, type InitialPrintTechnique } from "@/components/PrintTechniqueForm";

export default async function EditPrintTechniquePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: technique } = await supabase
    .from("print_techniques")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!technique) notFound();

  const initial: InitialPrintTechnique = {
    id: technique.id,
    name: technique.name,
    finishDescription: technique.finish_description,
    colorModeDescription: technique.color_mode_description,
    sortOrder: technique.sort_order,
    stripSourceColor: technique.strip_source_color,
    singleColorInk: technique.single_color_ink,
    singleColorFillMode: technique.single_color_fill_mode === "reference" ? "reference" : "silhouette",
  };

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">{technique.name}</h1>
      <p className="text-muted mb-8">Edit this print technique.</p>
      <PrintTechniqueForm initial={initial} />
    </div>
  );
}
