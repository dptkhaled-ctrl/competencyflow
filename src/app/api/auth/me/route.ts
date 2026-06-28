import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { getSessionPlatformUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      authenticated: false,
    });
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({
      configured: true,
      authenticated: false,
    });
  }

  const platformUser = await getSessionPlatformUser();
  if (!platformUser) {
    return NextResponse.json({
      configured: true,
      authenticated: false,
      needsProfile: true,
      authUser: {
        id: authUser.id,
        email: authUser.email,
        phone: authUser.phone,
      },
    });
  }

  return NextResponse.json({
    configured: true,
    authenticated: true,
    user: {
      id: platformUser.id,
      name: platformUser.name,
      email: platformUser.email,
      phone: platformUser.phone,
      role: platformUser.role,
      orgId: platformUser.orgId,
    },
    authUser: {
      id: authUser.id,
      email: authUser.email,
      phone: authUser.phone,
    },
  });
}