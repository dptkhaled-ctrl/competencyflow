import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { provisionAuthUser } from "@/lib/server/data-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { UserRole } from "@/lib/types";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 }
    );
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const role = (body.role === "manager" ? "manager" : "staff") as UserRole;
  const phone =
    typeof body.phone === "string" ? body.phone.trim() : authUser.phone ?? undefined;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const user = await provisionAuthUser({
    authUserId: authUser.id,
    name,
    email: authUser.email ?? undefined,
    phone,
    role,
  });

  if (!user) {
    return NextResponse.json(
      { error: "Could not create your account" },
      { status: 500 }
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