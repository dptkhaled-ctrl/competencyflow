/**
 * One-time setup: creates Supabase Storage buckets and seeds platform.json if empty.
 * Run: node scripts/init-cloud-storage.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env.local optional when vars are already exported
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PLATFORM_BUCKET = "app-data";
const UPLOADS_BUCKET = "uploads";
const PLATFORM_FILE = "platform.json";

async function ensureBucket(name) {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw error;
  if (buckets?.some((b) => b.name === name)) {
    console.log(`Bucket "${name}" already exists`);
    return;
  }
  const { error: createError } = await admin.storage.createBucket(name, {
    public: false,
  });
  if (createError) throw createError;
  console.log(`Created bucket "${name}"`);
}

async function main() {
  await ensureBucket(PLATFORM_BUCKET);
  await ensureBucket(UPLOADS_BUCKET);

  const { data: existing, error: downloadError } = await admin.storage
    .from(PLATFORM_BUCKET)
    .download(PLATFORM_FILE);

  if (!downloadError && existing) {
    console.log("platform.json already exists in cloud storage — nothing to seed.");
    return;
  }

  const seedPath = resolve(root, "data", "platform.json");
  let seedBody;
  try {
    seedBody = readFileSync(seedPath, "utf8");
    console.log("Seeding from local data/platform.json");
  } catch {
    const { createInitialPlatformData, migratePlatformData } = await import(
      "../src/lib/server/seed-platform.ts"
    ).catch(() => ({ createInitialPlatformData: null, migratePlatformData: null }));

    if (createInitialPlatformData && migratePlatformData) {
      seedBody = JSON.stringify(
        migratePlatformData(createInitialPlatformData()),
        null,
        2
      );
      console.log("Seeding with default platform data");
    } else {
      seedBody = JSON.stringify({ organizations: [], teams: [], users: [], invites: [] });
      console.log("Seeding with minimal empty platform (run app once to fully initialize)");
    }
  }

  const { error: uploadError } = await admin.storage
    .from(PLATFORM_BUCKET)
    .upload(PLATFORM_FILE, seedBody, {
      upsert: true,
      contentType: "application/json",
    });

  if (uploadError) throw uploadError;
  console.log("Uploaded platform.json to Supabase Storage — persistence is ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});