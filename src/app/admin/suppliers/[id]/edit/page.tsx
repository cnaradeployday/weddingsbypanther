import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { getBackofficePermissions } from "@/lib/permissions";
import { SupplierEditForm, type InitialSupplier } from "@/components/SupplierEditForm";

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();
  const perms = await getBackofficePermissions(supabase, session.profile);
  if (!perms.suppliers.read) redirect("/admin");

  const { data: supplier } = await supabase.from("suppliers").select("*").eq("id", id).maybeSingle();
  if (!supplier) notFound();

  const { data: profile } = supplier.profile_id
    ? await supabase.from("profiles").select("email").eq("id", supplier.profile_id).maybeSingle()
    : { data: null };

  const initial: InitialSupplier = {
    id: supplier.id,
    businessName: supplier.business_name,
    legalName: supplier.legal_name,
    contactFirstName: supplier.contact_first_name,
    contactLastName: supplier.contact_last_name,
    email: profile?.email ?? null,
    phone: supplier.phone,
    website: supplier.website,
    vatNumber: supplier.vat_number,
    headcount: supplier.headcount,
    sinceYear: supplier.since_year,
    address: supplier.address,
    city: supplier.city,
    country: supplier.country,
    description: supplier.description,
  };

  return (
    <div>
      <p className="text-sm text-muted mb-2">
        <Link href="/admin/suppliers">Suppliers</Link> / Edit
      </p>
      <h1 className="font-serif text-3xl mb-1">{supplier.business_name}</h1>
      <p className="text-muted mb-8">Edit this supplier&apos;s details.</p>
      {perms.suppliers.write ? (
        <SupplierEditForm initial={initial} />
      ) : (
        <p className="text-muted">You don&apos;t have permission to edit suppliers.</p>
      )}
    </div>
  );
}
