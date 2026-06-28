import { NextResponse } from "next/server";
import {
  clearManagerRequestFlags,
  deleteUploadedMaterial,
  readPlatform,
  readUploadFile,
} from "@/lib/server/data-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const platform = await readPlatform();
  const material = platform.uploadedMaterials.find((m) => m.id === id);
  if (!material?.storagePath) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = await readUploadFile(material.storagePath);
  if (!buffer) {
    return NextResponse.json({ error: "File missing in storage" }, { status: 404 });
  }

  const safeName = material.fileName.replace(/[^\w.\-() ]+/g, "_") || "download";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": material.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(material.fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.action === "markProcessed") {
    const material = await clearManagerRequestFlags(id);
    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }
    return NextResponse.json({ material });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const deleteLessons = searchParams.get("deleteLessons") === "true";

  const result = await deleteUploadedMaterial(id, deleteLessons);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    message: deleteLessons
      ? "File and associated lessons removed."
      : "File removed. Lessons were kept.",
  });
}