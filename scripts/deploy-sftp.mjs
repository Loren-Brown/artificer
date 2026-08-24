#!/usr/bin/env node
/**
 * Build (optional) and publish app/dist to a remote host over SFTP.
 * Credentials come from repo-root .env (see .env.example).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import SftpClient from "ssh2-sftp-client";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "app", "dist");
const envPath = path.join(rootDir, ".env");

dotenv.config({ path: envPath });

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required env var: ${name} (set it in .env — see .env.example)`);
    process.exit(1);
  }
  return value;
}

function truthy(name) {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function runBuild() {
  console.log("Building app…");
  const result = spawnSync("npm", ["run", "app:build"], {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error("Build failed; aborting deploy.");
    process.exit(result.status ?? 1);
  }
}

async function deploy() {
  if (!fs.existsSync(envPath)) {
    console.error(
      `No .env found at ${envPath}. Copy .env.example to .env and fill in SFTP_* values.`,
    );
    process.exit(1);
  }

  const host = requireEnv("SFTP_HOST");
  const username = requireEnv("SFTP_USER");
  const password = requireEnv("SFTP_PASSWORD");
  const remoteDir = requireEnv("SFTP_REMOTE_DIR").replace(/\/+$/, "");
  const port = Number(process.env.SFTP_PORT?.trim() || "22");

  if (!Number.isFinite(port) || port <= 0) {
    console.error("SFTP_PORT must be a positive number.");
    process.exit(1);
  }

  if (!truthy("DEPLOY_SKIP_BUILD")) {
    runBuild();
  } else {
    console.log("Skipping build (DEPLOY_SKIP_BUILD).");
  }

  if (!fs.existsSync(distDir)) {
    console.error(`Missing ${distDir}. Run a build first or unset DEPLOY_SKIP_BUILD.`);
    process.exit(1);
  }

  const sftp = new SftpClient();
  try {
    console.log(`Connecting to ${username}@${host}:${port}…`);
    await sftp.connect({
      host,
      port,
      username,
      password,
      readyTimeout: 20000,
    });

    const remoteExists = await sftp.exists(remoteDir);
    if (!remoteExists) {
      console.log(`Creating remote directory ${remoteDir}…`);
      await sftp.mkdir(remoteDir, true);
    } else if (remoteExists !== "d") {
      console.error(`SFTP_REMOTE_DIR exists but is not a directory: ${remoteDir}`);
      process.exit(1);
    }

    if (truthy("SFTP_CLEAR_REMOTE")) {
      console.log(`Clearing remote directory ${remoteDir}…`);
      const listing = await sftp.list(remoteDir);
      for (const entry of listing) {
        const target = `${remoteDir}/${entry.name}`;
        if (entry.type === "d") {
          await sftp.rmdir(target, true);
        } else {
          await sftp.delete(target);
        }
      }
    }

    console.log(`Uploading ${distDir} → ${remoteDir}…`);
    await sftp.uploadDir(distDir, remoteDir);
    console.log("Deploy complete.");
  } catch (err) {
    console.error("Deploy failed:", err?.message || err);
    process.exit(1);
  } finally {
    try {
      await sftp.end();
    } catch {
      /* ignore */
    }
  }
}

deploy();
