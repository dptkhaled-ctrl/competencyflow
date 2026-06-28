import { cookies } from "next/headers";

export const ADMIN_COOKIE = "cf_admin_session";
const SESSION_VALUE = "authenticated";

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "CompetencyFlow2026!";
}

export function verifyAdminPassword(password: string): boolean {
  return password === getAdminPassword();
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE)?.value === SESSION_VALUE;
}

export function adminSessionCookie(): {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    name: ADMIN_COOKIE,
    value: SESSION_VALUE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}