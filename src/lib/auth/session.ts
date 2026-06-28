import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  findUserByAuthUserId,
  findUserByEmail,
  findUserByPhone,
} from "@/lib/server/data-store";
import type { User } from "@/lib/types";

export async function getAuthUser() {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function getSessionPlatformUser(): Promise<User | null> {
  const authUser = await getAuthUser();
  if (!authUser) return null;

  const byAuthId = await findUserByAuthUserId(authUser.id);
  if (byAuthId) return byAuthId;

  if (authUser.email) {
    const byEmail = await findUserByEmail(authUser.email);
    if (byEmail) return byEmail;
  }

  if (authUser.phone) {
    const byPhone = await findUserByPhone(authUser.phone);
    if (byPhone) return byPhone;
  }

  return null;
}