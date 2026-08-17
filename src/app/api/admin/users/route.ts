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

function slugify(input: string) {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function POST(req: NextRequest) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const supabase = await createClient();
  const perms = await getBackofficePermissions(supabase, session.profile);
  if (!perms.users.write) {
    return NextResponse.json({ error: "You don't have permission to create users." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email: string = body?.email?.trim().toLowerCase() ?? "";
  const fullName: string = body?.fullName?.trim() ?? "";
  const roleSelection: string = body?.roleSelection ?? "none"; // "none" | "super_admin" | <role_id>
  const plannerName: string = body?.plannerName?.trim() ?? "";
  const supplierName: string = body?.supplierName?.trim() ?? "";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
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
    user_metadata: { role: "customer", full_name: fullName || undefined },
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Could not create the user account." },
      { status: 400 }
    );
  }

  const userId = created.user.id;

  if (roleSelection === "super_admin") {
    await admin.from("profiles").update({ must_change_password: true, role: "admin", role_id: null }).eq("id", userId);
  } else if (roleSelection !== "none") {
    await admin
      .from("profiles")
      .update({ must_change_password: true, role_id: roleSelection })
      .eq("id", userId);
  } else {
    await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
  }

  if (plannerName) {
    await admin.from("planners").insert({
      profile_id: userId,
      business_name: plannerName,
      slug: slugify(plannerName),
      status: "approved",
    });
  }

  if (supplierName) {
    await admin.from("suppliers").insert({
      profile_id: userId,
      business_name: supplierName,
      slug: slugify(supplierName),
      status: "approved",
    });
  }

  return NextResponse.json({ email, tempPassword });
}
