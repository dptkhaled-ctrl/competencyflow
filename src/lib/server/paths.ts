import path from "path";
import os from "os";

/** Vercel/serverless only allows writes under /tmp — use it in production. */
function resolveDataDir() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "competencyflow-data");
  }
  return path.join(process.cwd(), "data");
}

function resolveUploadsDir() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "competencyflow-uploads");
  }
  return path.join(process.cwd(), "private", "uploads");
}

export const WORKSPACE_ROOT = path.join(process.cwd(), "..");
export const DATA_DIR = resolveDataDir();
export const PLATFORM_FILE = path.join(DATA_DIR, "platform.json");
export const UPLOADS_DIR = resolveUploadsDir();