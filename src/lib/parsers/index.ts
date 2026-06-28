import mammoth from "mammoth";
import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";
import type { UploadFileType } from "@/lib/types";

export function detectFileType(fileName: string, mimeType: string): UploadFileType {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf" || mimeType === "application/pdf") return "pdf";
  if (ext === "docx" || mimeType.includes("wordprocessingml")) return "docx";
  if (ext === "pptx" || mimeType.includes("presentationml")) return "pptx";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext) || mimeType.startsWith("image/"))
    return "image";
  if (["txt", "md", "csv"].includes(ext) || mimeType.startsWith("text/")) return "text";
  return "unknown";
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  const raw = Array.isArray(text) ? text.join("\n\n") : String(text ?? "");
  return raw.trim();
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value?.trim() ?? "";
}

async function parsePptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideTexts: string[] = [];

  const slideFiles = Object.keys(zip.files)
    .filter((n) => n.match(/ppt\/slides\/slide\d+\.xml$/))
    .sort();

  for (const slidePath of slideFiles) {
    const xml = await zip.files[slidePath].async("string");
    const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    if (texts.length > 0) slideTexts.push(texts.join(" "));
  }

  return slideTexts.join("\n\n").trim();
}

function parseImage(fileName: string): string {
  return `[Image uploaded: ${fileName}. Add a companion text document for policy content, or edit generated lessons in admin after upload.]`;
}

function parseText(buffer: Buffer): string {
  return buffer.toString("utf-8").trim();
}

export async function extractTextFromFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ text: string; fileType: UploadFileType }> {
  const fileType = detectFileType(fileName, mimeType);

  let text = "";
  switch (fileType) {
    case "pdf":
      text = await parsePdf(buffer);
      break;
    case "docx":
      text = await parseDocx(buffer);
      break;
    case "pptx":
      text = await parsePptx(buffer);
      break;
    case "image":
      text = parseImage(fileName);
      break;
    case "text":
      text = parseText(buffer);
      break;
    default:
      text = parseText(buffer).slice(0, 5000);
  }

  return { text, fileType };
}