import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  acceptInvite,
  findUserByAuthUserId,
  linkAuthUser,
  provisionAuthUser,
} from "@/lib/server/data-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const inviteToken =
    typeof body.inviteToken === "string" ? body.inviteToken.trim() : undefined;

  if (inviteToken) {
    const user = await acceptInvite(
      inviteToken,
      authUser.id,
      authUser.email ?? undefined
    );
    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired invite" },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        orgId: user.orgId,
      },
    });
  }

  const existing = await findUserByAuthUserId(authUser.id);
  if (existing) {
    return NextResponse.json({
      ok: true,
      user: {
        id: existing.id,
        name: existing.name,
        role: existing.role,
        orgId: existing.orgId,
      },
    });
  }

  return NextResponse.json(
    {
      error:
        "Your account is not set up yet. Use the invite link from your administrator or manager.",
    },
    { status: 403 }
  );
}