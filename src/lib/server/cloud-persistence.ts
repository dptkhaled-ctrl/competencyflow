import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import type { PlatformData } from "@/lib/types";

const PLATFORM_BUCKET = "app-data";
const UPLOADS_BUCKET = "uploads";
const PLATFORM_FILE = "platform.json";

const SUPABASE_PREFIX = "supabase:";

let bucketsReady = false;

export function isCloudPersistenceEnabled(): boolean {
  return hasServiceRoleKey();
}

export function isSupabaseStoragePath(storagePath: string): boolean {
  return storagePath.startsWith(SUPABASE_PREFIX);
}

export function toSupabaseStoragePath(bucket: string, objectPath: string): string {
  return `${SUPABASE_PREFIX}${bucket}/${objectPath}`;
}

export function parseSupabaseStoragePath(
  storagePath: string
): { bucket: string; objectPath: string } | null {
  if (!isSupabaseStoragePath(storagePath)) return null;
  const rest = storagePath.slice(SUPABASE_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash === -1) return null;
  return {
    bucket: rest.slice(0, slash),
    objectPath: rest.slice(slash + 1),
  };
}

async function ensureBuckets(): Promise<void> {
  if (bucketsReady) return;
  const admin = createAdminClient();
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) throw listError;

  const names = new Set((buckets ?? []).map((b) => b.name));
  if (!names.has(PLATFORM_BUCKET)) {
    const { error } = await admin.storage.createBucket(PLATFORM_BUCKET, {
      public: false,
    });
    if (error && !error.message.toLowerCase().includes("already exists")) {
      throw error;
    }
  }
  if (!names.has(UPLOADS_BUCKET)) {
    const { error } = await admin.storage.createBucket(UPLOADS_BUCKET, {
      public: false,
    });
    if (error && !error.message.toLowerCase().includes("already exists")) {
      throw error;
    }
  }
  bucketsReady = true;
}

export async function readPlatformFromCloud(): Promise<PlatformData | null> {
  if (!isCloudPersistenceEnabled()) return null;
  await ensureBuckets();
  const admin = createAdminClient();

  const { data, error } = await admin.storage
    .from(PLATFORM_BUCKET)
    .download(PLATFORM_FILE);

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("not found") || msg.includes("object not found")) {
      return null;
    }
    throw error;
  }

  const text = await data.text();
  return JSON.parse(text) as PlatformData;
}

export async function writePlatformToCloud(data: PlatformData): Promise<void> {
  if (!isCloudPersistenceEnabled()) {
    throw new Error("Cloud persistence is not configured");
  }
  await ensureBuckets();
  const admin = createAdminClient();
  const body = JSON.stringify(data, null, 2);

  const { error } = await admin.storage.from(PLATFORM_BUCKET).upload(
    PLATFORM_FILE,
    body,
    {
      upsert: true,
      contentType: "application/json",
      cacheControl: "no-cache",
    }
  );

  if (error) throw error;
}

export async function saveUploadToCloud(
  orgId: string,
  fileId: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  if (!isCloudPersistenceEnabled()) {
    throw new Error("Cloud persistence is not configured");
  }
  await ensureBuckets();
  const admin = createAdminClient();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${orgId}/${fileId}-${safeName}`;

  const { error } = await admin.storage.from(UPLOADS_BUCKET).upload(objectPath, buffer, {
    upsert: true,
    contentType: "application/octet-stream",
  });

  if (error) throw error;
  return toSupabaseStoragePath(UPLOADS_BUCKET, objectPath);
}

export async function readUploadFromCloud(storagePath: string): Promise<Buffer | null> {
  const parsed = parseSupabaseStoragePath(storagePath);
  if (!parsed) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(parsed.bucket)
    .download(parsed.objectPath);
  if (error) return null;
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function deleteUploadFromCloud(storagePath: string): Promise<void> {
  const parsed = parseSupabaseStoragePath(storagePath);
  if (!parsed) return;
  const admin = createAdminClient();
  await admin.storage.from(parsed.bucket).remove([parsed.objectPath]);
}