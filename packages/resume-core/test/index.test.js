import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { stripPrivateFields } from "../src/stripPrivate.js";
import {
  sanitizeLatexFileName,
  sanitizeLatexContent,
} from "../src/resumeNames.js";
import { formatData } from "../src/format.js";
import { bus } from "../src/events.js";
import { createResumeHistory } from "../src/resumeHistory.js";
import { createMemoryRoot } from "../../filesystem-core/test/memfs.js";
import {
  writeTextFile,
  readTextFile,
  ensureWorkspaceLayout,
} from "../../filesystem-core/src/index.js";

vi.mock("../src/compile.js", () => ({
  compileLatexWithSwiftLatex: vi.fn(async () => ({
    pdf: new Uint8Array([37, 80, 68, 70]), // %PDF
    log: "ok",
  })),
}));

describe("stripPrivateFields", () => {
  it("removes underscore-prefixed keys recursively", () => {
    expect(
      stripPrivateFields({
        name: "Ada",
        _secret: "x",
        nested: { keep: 1, _drop: 2 },
        list: [{ a: 1, _b: 2 }],
      }),
    ).toEqual({
      name: "Ada",
      nested: { keep: 1 },
      list: [{ a: 1 }],
    });
  });
});

describe("resumeNames", () => {
  it("sanitizes latex filenames", () => {
    expect(sanitizeLatexFileName("CURRENT_foo.tex")).toBe("foo.tex");
    expect(sanitizeLatexFileName("my-resume.tex")).toBe("my-resume.tex");
    expect(() => sanitizeLatexFileName("../x.tex")).toThrow(/Invalid/);
    expect(() => sanitizeLatexFileName("noext")).toThrow(/\.tex/);
  });

  it("blocks dangerous latex constructs", () => {
    expect(sanitizeLatexContent("\\section{Hi}")).toContain("section");
    expect(() => sanitizeLatexContent("\\write18{rm -rf /}")).toThrow(
      /disallowed/,
    );
    expect(() => sanitizeLatexContent("\\input{|cmd}")).toThrow(/disallowed/);
  });
});

describe("formatData", () => {
  it("orders known keys for general documents", () => {
    const formatted = formatData(
      {
        summary: "s",
        name: "N",
        title: "T",
      },
      "general.json",
    );
    expect(Object.keys(formatted).slice(0, 3)).toEqual([
      "name",
      "title",
      "summary",
    ]);
  });
});

describe("events bus", () => {
  it("delivers payloads to subscribers", () => {
    const seen = [];
    const off = bus.on("test:event", (p) => seen.push(p));
    bus.emit("test:event", { ok: true });
    off();
    bus.emit("test:event", { ok: false });
    expect(seen).toEqual([{ ok: true }]);
  });
});

describe("resumeHistory", () => {
  it("pushes versions and supports undo/redo", async () => {
    const root = createMemoryRoot();
    await ensureWorkspaceLayout(root);
    const history = createResumeHistory({ root });

    await history.push("demo.tex", "v1");
    await history.push("demo.tex", "v2");
    let meta = await history.meta("demo.tex");
    expect(meta.canUndo).toBe(true);
    expect(meta.canRedo).toBe(false);

    const undone = await history.undo("demo.tex");
    expect(undone.content).toBe("v1");
    expect(undone.history.canRedo).toBe(true);

    const redone = await history.redo("demo.tex");
    expect(redone.content).toBe("v2");
  });
});

describe("createResumeCore", () => {
  let originalFetch;

  beforeEach(() => {
    vi.resetModules();
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).includes("/schemas/") || String(url).startsWith("/schemas/")) {
        return {
          ok: true,
          async json() {
            const name = String(url).split("/").pop();
            return { $id: name, type: "object", additionalProperties: true };
          },
        };
      }
      if (typeof originalFetch === "function") return originalFetch(url);
      throw new Error(`Unexpected fetch: ${url}`);
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("selects, stores, and exposes public resume text/pdf", async () => {
    const { createResumeCore } = await import("../src/index.js");
    const root = createMemoryRoot();
    await ensureWorkspaceLayout(root);
    await writeTextFile(
      root,
      ["resumes", "demo.tex"],
      "\\documentclass{article}\\begin{document}Hi\\end{document}\n",
    );

    const api = await createResumeCore({ root });
    const selected = await api.selectResume("demo.tex");
    expect(selected.compiled).toBe(true);
    expect(selected.pdf).toBe("demo.pdf");

    const status = await api.getPublicResumeStatus();
    expect(status.current).toBe("demo.tex");
    expect(status.pdf).toBe("demo.pdf");

    const text = await api.getPublicResumeText();
    expect(text).toContain("documentclass");

    const pdf = await api.getPublicResumePdfBytes();
    expect(pdf[0]).toBe(37); // %

    const stored = await api.storeResume(
      "demo.tex",
      "\\documentclass{article}\\begin{document}Bye\\end{document}\n",
    );
    expect(stored.compiled).toBe(true);
  });

  it("auto-selects the first resume when .current is unset", async () => {
    const { createResumeCore } = await import("../src/index.js");
    const root = createMemoryRoot();
    await ensureWorkspaceLayout(root);
    await writeTextFile(
      root,
      ["resumes", "zeta.tex"],
      "\\documentclass{article}\\begin{document}Z\\end{document}\n",
    );
    await writeTextFile(
      root,
      ["resumes", "alpha.tex"],
      "\\documentclass{article}\\begin{document}A\\end{document}\n",
    );

    const api = await createResumeCore({ root });
    const listed = await api.listResumes();
    expect(listed.items).toEqual(["alpha.tex", "zeta.tex"]);
    expect(listed.current).toBe("alpha.tex");

    const status = await api.getPublicResumeStatus();
    expect(status.current).toBe("alpha.tex");

    const pointer = await readTextFile(root, ["app", ".current"]);
    expect(pointer.trim()).toBe("alpha.tex");
  });

  it("strips private fields on public documents", async () => {
    const { createResumeCore } = await import("../src/index.js");
    const root = createMemoryRoot();
    await ensureWorkspaceLayout(root);
    await writeTextFile(
      root,
      ["resume-data", "general.json"],
      JSON.stringify({ name: "Ada", _notes: "private" }, null, 2),
    );

    const api = await createResumeCore({ root });
    const doc = await api.getPublicDocument("general");
    expect(doc.name).toBe("Ada");
    expect(doc._notes).toBeUndefined();
  });
});
