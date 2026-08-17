import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// The anon/publishable key is safe to ship to the browser — access is
// enforced by Postgres row-level security policies, not by key secrecy.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://fqomygvhtdocfnisasrb.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxb215Z3ZodGRvY2ZuaXNhc3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Nzg2MTAsImV4cCI6MjEwMjU1NDYxMH0.oXXBJ1kGCB-KfIlu8ZLBMscG_dXv9k6RrSmPn_KaNfk";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
