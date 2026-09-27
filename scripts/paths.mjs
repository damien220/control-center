import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function defaultDataDirectory() {
  if (process.platform === "darwin")
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Control Center",
    );
  if (process.platform === "win32")
    return path.join(
      process.env.LOCALAPPDATA || process.env.APPDATA || os.homedir(),
      "Control Center",
    );
  return path.join(
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"),
    "control-center",
  );
}

export function resolveDataDirectory(cwd = process.cwd()) {
  const configured = process.env.CONTROL_CENTER_DATA_DIR?.trim();
  if (configured) {
    if (!path.isAbsolute(configured))
      throw new Error("CONTROL_CENTER_DATA_DIR must be an absolute path.");
    return configured;
  }
  const legacy = path.join(cwd, ".control-center");
  return existsSync(legacy) ? legacy : defaultDataDirectory();
}

export function npmCommand() {
  if (process.env.npm_execpath)
    return { command: process.execPath, prefix: [process.env.npm_execpath] };
  return {
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    prefix: [],
  };
}

export function loadLocalEnvironment(cwd = process.cwd()) {
  const environmentPath = path.join(cwd, ".env.local");
  if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);
}

// Mirrors lib/access-token.ts, which the server uses; keep the two in step.
const MIN_ACCESS_TOKEN_LENGTH = 32;

export function accessTokenPath(dataDirectory) {
  return path.join(dataDirectory, "access-token");
}

export function readOrCreateAccessToken(dataDirectory, { rotate = false } = {}) {
  const configured = process.env.CONTROL_CENTER_ACCESS_TOKEN?.trim();
  if (configured) {
    if (configured.length < MIN_ACCESS_TOKEN_LENGTH)
      throw new Error(
        `CONTROL_CENTER_ACCESS_TOKEN must be at least ${MIN_ACCESS_TOKEN_LENGTH} characters.`,
      );
    return configured;
  }
  const target = accessTokenPath(dataDirectory);
  if (!rotate && existsSync(target)) {
    const stored = readFileSync(target, "utf8").trim();
    if (stored.length >= MIN_ACCESS_TOKEN_LENGTH) return stored;
  }
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const created = randomBytes(32).toString("base64url");
  writeFileSync(target, `${created}\n`, { mode: 0o600 });
  chmodSync(target, 0o600);
  return created;
}
