import { notFound, redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { UserAccessForm } from "@/components/UserAccessForm";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const [{ data: profile }, { data: roles }, { data: planner }, { data: supplier }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("roles").select("id, name").order("name"),
    supabase.from("planners").select("id, business_name").eq("profile_id", id).maybeSingle(),
    supabase.from("suppliers").select("id, business_name").eq("profile_id", id).maybeSingle(),
  ]);

  if (!profile) notFound();

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">{profile.full_name ?? profile.email}</h1>
      <p className="text-muted mb-8">{profile.email}</p>
      <UserAccessForm profile={profile} roles={roles ?? []} planner={planner} supplier={supplier} />
    </div>
  );
}
