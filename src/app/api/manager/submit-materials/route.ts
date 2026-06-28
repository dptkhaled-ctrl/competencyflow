import { NextResponse } from "next/server";
import { detectFileType } from "@/lib/parsers";
import { readPlatform, submitManagerMaterials } from "@/lib/server/data-store";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const orgId = String(formData.get("orgId") ?? "").trim();
    const managerId = String(formData.get("managerId") ?? "").trim();
    const managerName = String(formData.get("managerName") ?? "").trim();
    const requestNote = String(formData.get("requestNote") ?? "").trim();

    if (!orgId || !managerId || !managerName) {
      return NextResponse.json(
        { error: "orgId, managerId, and managerName are required" },
        { status: 400 }
      );
    }

    const platform = await readPlatform();
    const manager = platform.users.find((u) => u.id === managerId);
    if (!manager || manager.role !== "manager" || manager.orgId !== orgId) {
      return NextResponse.json({ error: "Invalid manager" }, { status: 400 });
    }

    const fileEntries = formData.getAll("files").filter((f) => f instanceof File) as File[];
    if (fileEntries.length === 0 && !requestNote) {
      return NextResponse.json(
        { error: "Upload at least one file or add instructions" },
        { status: 400 }
      );
    }

    const files = await Promise.all(
      fileEntries.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileType: detectFileType(file.name, file.type || ""),
          fileSize: file.size,
          buffer,
        };
      })
    );

    const materials = await submitManagerMaterials({
      orgId,
      managerId,
      managerName,
      requestNote:
        requestNote || "No specific request provided by the manager.",
      files,
    });

    return NextResponse.json({ materials, count: materials.length }, { status: 201 });
  } catch (err) {
    console.error("Manager submit materials error:", err);
    return NextResponse.json(
      { error: "Failed to submit materials" },
      { status: 500 }
    );
  }
}