import { describe, expect, it } from "vitest";
import {
  WORKSPACE_SUBDIRS,
  ensureWorkspaceLayout,
  getDir,
  pathExists,
  readTextFile,
  writeTextFile,
  readBinaryFile,
  writeBinaryFile,
  listNames,
  removeFile,
  dirIsEmpty,
  ensurePermission,
} from "../src/index.js";
import { createMemoryRoot } from "./memfs.js";

describe("filesystem-core", () => {
  it("exports the expected workspace subdirs", () => {
    expect(WORKSPACE_SUBDIRS).toEqual([
      "resume-data",
      "resumes",
      "resume-examples",
      "prompts",
      "app",
    ]);
  });

  it("ensureWorkspaceLayout creates top-level and app dirs", async () => {
    const root = createMemoryRoot();
    await ensureWorkspaceLayout(root);
    for (const name of WORKSPACE_SUBDIRS) {
      expect(await pathExists(root, [name], "dir")).toBe(true);
    }
    expect(await pathExists(root, ["app", "compiled"], "dir")).toBe(true);
    expect(await pathExists(root, ["app", "logs"], "dir")).toBe(true);
    expect(await pathExists(root, ["app", "history"], "dir")).toBe(true);
  });

  it("rejects invalid path segments", async () => {
    const root = createMemoryRoot();
    await expect(getDir(root, [".."], { create: true })).rejects.toThrow(
      /Invalid path segment/,
    );
    await expect(getDir(root, ["."], { create: true })).rejects.toThrow(
      /Invalid path segment/,
    );
  });

  it("round-trips text and binary files", async () => {
    const root = createMemoryRoot();
    await writeTextFile(root, ["resumes", "a.tex"], "hello\\n");
    expect(await readTextFile(root, ["resumes", "a.tex"])).toBe("hello\\n");

    const bytes = new Uint8Array([1, 2, 3, 4]);
    await writeBinaryFile(root, ["app", "compiled", "a.pdf"], bytes);
    const read = await readBinaryFile(root, ["app", "compiled", "a.pdf"]);
    expect(Array.from(read)).toEqual([1, 2, 3, 4]);
  });

  it("lists, removes, and reports empty dirs", async () => {
    const root = createMemoryRoot();
    await writeTextFile(root, ["resumes", "b.tex"], "x");
    await writeTextFile(root, ["resumes", "a.tex"], "y");
    expect(await listNames(root, ["resumes"], { files: true })).toEqual([
      "a.tex",
      "b.tex",
    ]);
    expect(await dirIsEmpty(root, ["resumes"])).toBe(false);
    await removeFile(root, ["resumes", "a.tex"]);
    await removeFile(root, ["resumes", "b.tex"]);
    expect(await dirIsEmpty(root, ["resumes"])).toBe(true);
    expect(await pathExists(root, ["resumes", "a.tex"], "file")).toBe(false);
  });

  it("ensurePermission returns true for granted handles", async () => {
    const root = createMemoryRoot();
    expect(await ensurePermission(root, "readwrite")).toBe(true);
    expect(await ensurePermission(null)).toBe(false);
  });
});
