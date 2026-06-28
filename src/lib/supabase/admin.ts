import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase/config";

export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(getSupabaseUrl(), serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}