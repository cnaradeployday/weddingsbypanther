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
  if (!perms.planners.write) {
    return NextResponse.json({ error: "You don't have permission to create planners." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const businessName: string = body?.businessName?.trim() ?? "";
  const email: string = body?.email?.trim().toLowerCase() ?? "";
  const fullName: string = body?.fullName?.trim() ?? "";
  const businessType: string = body?.businessType === "merchandise" ? "merchandise" : "wedding";

  if (!businessName || !email) {
    return NextResponse.json({ error: "Studio name and email are required." }, { status: 400 });
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
      role: "planner",
      business_name: businessName,
      business_type: businessType,
      full_name: fullName || undefined,
    },
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Could not create the planner account." },
      { status: 400 }
    );
  }

  const userId = created.user.id;

  await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);

  const { data: planner } = await admin
    .from("planners")
    .update({ status: "approved" })
    .eq("profile_id", userId)
    .select()
    .maybeSingle();

  if (!planner) {
    return NextResponse.json(
      { error: "Account created, but the planner record couldn't be found. Check Planners." },
      { status: 500 }
    );
  }

  return NextResponse.json({ email, tempPassword, planner });
}
