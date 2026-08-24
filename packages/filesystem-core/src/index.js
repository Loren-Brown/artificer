/**
 * Browser workspace filesystem (File System Access API).
 */

export { createMemoryRoot } from "./memfs.js";

export const WORKSPACE_SUBDIRS = [
  "resume-data",
  "resumes",
  "resume-examples",
  "prompts",
  "app",
];

export const HANDLE_DB = "resume-builder-workspace";
export const HANDLE_STORE = "handles";
export const HANDLE_KEY = "root";

function isNotFoundError(err) {
  return (
    err?.name === "NotFoundError" ||
    /could not be found/i.test(String(err?.message || ""))
  );
}

function pathLabel(segments) {
  return segments.filter(Boolean).join("/") || ".";
}

/** Resolve a public asset path against Vite's `base` (e.g. `/` or `/artificer/`). */
export function publicAssetUrl(path) {
  const base =
    (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
  return `${base}${String(path).replace(/^\//, "")}`;
}

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRootHandle(handle) {
  const db = await openHandleDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readwrite");
    tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadRootHandle() {
  const db = await openHandleDb();
  const handle = await new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readonly");
    const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return handle;
}

export async function clearRootHandle() {
  const db = await openHandleDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readwrite");
    tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function ensurePermission(handle, mode = "readwrite") {
  if (!handle) return false;
  try {
    const opts = { mode };
    if (typeof handle.queryPermission === "function") {
      if ((await handle.queryPermission(opts)) === "granted") return true;
    }
    if (typeof handle.requestPermission === "function") {
      if ((await handle.requestPermission(opts)) === "granted") return true;
    }
    // Native picker grants access for the chosen folder even without these methods.
    return typeof handle.getDirectoryHandle === "function";
  } catch (err) {
    // Stale IndexedDB handles throw NotFoundError here.
    if (isNotFoundError(err)) return false;
    throw err;
  }
}

export async function pickWorkspaceDirectory() {
  const picker = globalThis.showDirectoryPicker;
  if (typeof picker !== "function") {
    throw new Error(
      "This browser does not support choosing a local folder. Use Chrome or Edge over HTTPS/localhost.",
    );
  }
  return picker({
    mode: "readwrite",
    id: "resume-builder-workspace",
    startIn: "documents",
  });
}

/** Get or create a nested directory from path segments. */
export async function getDir(root, segments, { create = false } = {}) {
  let dir = root;
  const walked = [];
  for (const name of segments) {
    if (!name || name === "." || name === "..") {
      throw new Error(`Invalid path segment: ${name}`);
    }
    walked.push(name);
    try {
      dir = await dir.getDirectoryHandle(name, { create });
    } catch (err) {
      if (isNotFoundError(err)) {
        const e = new Error(
          create
            ? `Could not create folder "${pathLabel(walked)}". Re-pick the workspace folder — the browser may have lost access.`
            : `Missing folder "${pathLabel(walked)}" in the workspace.`,
        );
        e.name = "NotFoundError";
        e.cause = err;
        throw e;
      }
      if (err?.name === "TypeMismatchError") {
        const e = new Error(
          `"${pathLabel(walked)}" exists but is not a folder. Rename or remove that file and try again.`,
        );
        e.cause = err;
        throw e;
      }
      throw err;
    }
  }
  return dir;
}

export async function ensureWorkspaceLayout(root) {
  for (const name of WORKSPACE_SUBDIRS) {
    await root.getDirectoryHandle(name, { create: true });
  }
  await getDir(root, ["app", "compiled"], { create: true });
  await getDir(root, ["app", "logs"], { create: true });
  await getDir(root, ["app", "history"], { create: true });
}

export async function pathExists(root, segments, kind = "file") {
  try {
    if (kind === "dir") {
      await getDir(root, segments, { create: false });
      return true;
    }
    const parent = segments.slice(0, -1);
    const name = segments[segments.length - 1];
    const dir = parent.length
      ? await getDir(root, parent, { create: false })
      : root;
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

export async function readTextFile(root, segments) {
  const parent = segments.slice(0, -1);
  const name = segments[segments.length - 1];
  const dir = parent.length
    ? await getDir(root, parent, { create: false })
    : root;
  const fileHandle = await dir.getFileHandle(name);
  const file = await fileHandle.getFile();
  return file.text();
}

export async function readBinaryFile(root, segments) {
  const parent = segments.slice(0, -1);
  const name = segments[segments.length - 1];
  const dir = parent.length
    ? await getDir(root, parent, { create: false })
    : root;
  const fileHandle = await dir.getFileHandle(name);
  const file = await fileHandle.getFile();
  return new Uint8Array(await file.arrayBuffer());
}

async function writeBytes(root, segments, data) {
  const parent = segments.slice(0, -1);
  const name = segments[segments.length - 1];
  try {
    const dir = parent.length
      ? await getDir(root, parent, { create: true })
      : root;
    const fileHandle = await dir.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  } catch (err) {
    if (isNotFoundError(err)) {
      const e = new Error(
        `Could not write "${pathLabel(segments)}". Re-pick the workspace folder — the browser may have lost write access.`,
      );
      e.name = "NotFoundError";
      e.cause = err;
      throw e;
    }
    throw err;
  }
}

export async function writeTextFile(root, segments, text) {
  await writeBytes(root, segments, String(text ?? ""));
}

export async function writeBinaryFile(root, segments, bytes) {
  await writeBytes(root, segments, bytes);
}

export async function removeFile(root, segments) {
  const parent = segments.slice(0, -1);
  const name = segments[segments.length - 1];
  const dir = parent.length
    ? await getDir(root, parent, { create: false })
    : root;
  await dir.removeEntry(name);
}

export async function listNames(
  root,
  segments,
  { dirs = false, files = true } = {},
) {
  let dir;
  try {
    dir = segments.length
      ? await getDir(root, segments, { create: false })
      : root;
  } catch (err) {
    if (isNotFoundError(err)) return [];
    throw err;
  }
  const names = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "directory" && dirs) names.push(name);
    if (handle.kind === "file" && files) names.push(name);
  }
  return names.sort((a, b) => a.localeCompare(b));
}

export async function dirIsEmpty(root, segments) {
  try {
    const names = await listNames(root, segments, { dirs: true, files: true });
    return names.length === 0;
  } catch {
    return true;
  }
}

/**
 * Fetch a URL (seed asset) and write into the workspace.
 */
export async function copyUrlToWorkspace(root, segments, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch seed ${url} (${res.status})`);
  const contentType = String(res.headers.get("content-type") || "");
  // Vite SPA fallback returns index.html with 200 for missing public assets.
  if (contentType.includes("text/html")) {
    throw new Error(`Failed to fetch seed ${url} (got HTML fallback)`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  await writeBinaryFile(root, segments, buf);
}

const SEED_FILES = [
  ["prompts", "BASE.md", "seed/prompts/BASE.md"],
  ["prompts", "README.md", "seed/prompts/README.md"],
  ["prompts", "editors", "EDITOR.md", "seed/prompts/editors/EDITOR.md"],
  [
    "prompts",
    "editors",
    "Greg",
    "AGENT.md",
    "seed/prompts/editors/Greg/AGENT.md",
  ],
  [
    "prompts",
    "reviewers",
    "REVIEWER.md",
    "seed/prompts/reviewers/REVIEWER.md",
  ],
  [
    "prompts",
    "reviewers",
    "Default",
    "AGENT.md",
    "seed/prompts/reviewers/Default/AGENT.md",
  ],
  ["prompts", "rollplay", "ROLLPLAY.md", "seed/prompts/rollplay/ROLLPLAY.md"],
  [
    "prompts",
    "rollplay",
    "Default",
    "AGENT.md",
    "seed/prompts/rollplay/Default/AGENT.md",
  ],
  ["resumes", "demo.tex", "seed/resumes/demo.tex"],
  ["resume-examples", "example.tex", "seed/resume-examples/example.tex"],
  ["resume-data", "general.json", "seed/resume-data/general.json"],
  ["resume-data", "skills.json", "seed/resume-data/skills.json"],
  ["resume-data", "experience.json", "seed/resume-data/experience.json"],
  ["resume-data", "education.json", "seed/resume-data/education.json"],
  ["resume-data", "projects.json", "seed/resume-data/projects.json"],
  [
    "resume-data",
    "certifications.json",
    "seed/resume-data/certifications.json",
  ],
];

/**
 * Seed a new/empty workspace from /seed/* bundled assets.
 */
export async function seedWorkspace(root, { force = false } = {}) {
  await ensureWorkspaceLayout(root);

  const errors = [];
  for (const entry of SEED_FILES) {
    const url = publicAssetUrl(entry[entry.length - 1]);
    const segments = entry.slice(0, -1);
    try {
      const exists = await pathExists(root, segments, "file");
      if (exists && !force) continue;
      await copyUrlToWorkspace(root, segments, url);
    } catch (err) {
      errors.push(`${pathLabel(segments)}: ${err.message || err}`);
    }
  }

  if (errors.length === SEED_FILES.length) {
    throw new Error(
      `Could not write workspace files. Re-pick the folder in Chrome/Edge with write access.\n${errors.slice(0, 3).join("\n")}`,
    );
  }
}

/**
 * Ensure layout; seed defaults for any missing trees (prompts without roles, etc.).
 */
export async function prepareWorkspace(root) {
  await ensureWorkspaceLayout(root);

  const promptRoleDirs = await listNames(root, ["prompts"], {
    dirs: true,
    files: false,
  });
  if (promptRoleDirs.length > 0) return { promptsSegments: ["prompts"] };

  await seedWorkspace(root, { force: false });
  return { promptsSegments: ["prompts"] };
}

export async function openOrRestoreWorkspace() {
  let existing = null;
  try {
    existing = await loadRootHandle();
  } catch {
    return { handle: null, restored: false };
  }
  if (!existing) return { handle: null, restored: false };

  try {
    if (!(await ensurePermission(existing))) {
      return { handle: null, restored: false };
    }
    await prepareWorkspace(existing);
    return { handle: existing, restored: true };
  } catch (err) {
    // Stale / moved folder handles are common after restarts — fall back to gate.
    console.warn("Workspace restore failed; clearing saved folder handle", err);
    try {
      await clearRootHandle();
    } catch {
      /* ignore */
    }
    return { handle: null, restored: false };
  }
}

export async function bindNewWorkspace({ createNew = false } = {}) {
  const handle = await pickWorkspaceDirectory();
  const allowed = await ensurePermission(handle);
  if (!allowed) {
    throw new Error(
      "Write access to that folder was denied. Choose the folder again and allow editing.",
    );
  }

  try {
    await ensureWorkspaceLayout(handle);
    if (createNew) {
      await seedWorkspace(handle, { force: false });
      if (await dirIsEmpty(handle, ["resumes"])) {
        await seedWorkspace(handle, { force: true });
      }
    } else {
      await prepareWorkspace(handle);
    }
  } catch (err) {
    if (isNotFoundError(err)) {
      throw new Error(
        `${err.message || "Folder access failed."} Tip: pick app-workspace (or a folder you can write to), not a read-only copy.`,
      );
    }
    throw err;
  }

  await saveRootHandle(handle);
  return handle;
}
