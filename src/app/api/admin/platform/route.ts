import { NextResponse } from "next/server";
import { readPlatform } from "@/lib/server/data-store";

export async function GET() {
  const data = await readPlatform();
  return NextResponse.json(data);
}