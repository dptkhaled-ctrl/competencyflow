import { NextResponse } from "next/server";
import { adminSessionCookie, verifyAdminPassword } from "@/lib/auth/admin";

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };

  if (!password || !verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminSessionCookie());
  return response;
}