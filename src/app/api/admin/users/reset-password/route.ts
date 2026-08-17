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
  if (!perms.users.write) {
    return NextResponse.json({ error: "You don't have permission to reset passwords." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const userId: string | undefined = body?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
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

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password: tempPassword });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);

  return NextResponse.json({ tempPassword });
}
