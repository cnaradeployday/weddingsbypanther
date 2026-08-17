import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { getBackofficePermissions } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function POST(req: NextRequest) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const supabase = await createClient();
  const perms = await getBackofficePermissions(supabase, session.profile);
  if (!perms.suppliers.write) {
    return NextResponse.json({ error: "You don't have permission to create suppliers." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const businessName: string = body?.businessName?.trim() ?? "";
  const email: string = body?.email?.trim().toLowerCase() ?? "";
  const fullName: string = body?.fullName?.trim() ?? "";
  const sinceYear: number | null = body?.sinceYear ? Number(body.sinceYear) : null;

  if (!businessName || !email) {
    return NextResponse.json({ error: "Business name and email are required." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Supabase admin access isn't configured yet (missing SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 }
    );
  }

  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      role: "supplier",
      business_name: businessName,
      full_name: fullName || undefined,
    },
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Could not create the supplier account." },
      { status: 400 }
    );
  }

  const userId = created.user.id;

  await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);

  const { data: supplier } = await admin
    .from("suppliers")
    .update(sinceYear ? { status: "approved", since_year: sinceYear } : { status: "approved" })
    .eq("profile_id", userId)
    .select()
    .maybeSingle();

  if (!supplier) {
    return NextResponse.json(
      { error: "Account created, but the supplier record couldn't be found. Check Suppliers." },
      { status: 500 }
    );
  }

  return NextResponse.json({ email, tempPassword, supplier });
}
