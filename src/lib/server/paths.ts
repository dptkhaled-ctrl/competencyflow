import path from "path";

export const WORKSPACE_ROOT = path.join(process.cwd(), "..");
export const DATA_DIR = path.join(process.cwd(), "data");
export const PLATFORM_FILE = path.join(DATA_DIR, "platform.json");
export const UPLOADS_DIR = path.join(process.cwd(), "private", "uploads");