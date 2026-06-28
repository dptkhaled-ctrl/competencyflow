import { NextResponse } from "next/server";
import { adminSessionCookie, verifyAdminPassword } from "@/lib/auth/admin";

export async function POST(request: Request) {
  try {
    let body: { password?: string };
    try {
      body = (await request.json()) as { password?: string };
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { password } = body;

    if (!password || !verifyAdminPassword(password)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(adminSessionCookie());
    return response;
  } catch (err) {
    console.error("[admin/login]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}