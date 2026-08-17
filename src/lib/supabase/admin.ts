import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://fqomygvhtdocfnisasrb.supabase.co";

// Service-role client — bypasses RLS entirely. Only ever import this from a
// Route Handler or Server Action, never from a Client Component.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
