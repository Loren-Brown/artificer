/**
 * Integration: agent-style LaTeX updates through createResumeCore + in-memory FS.
 * Compile is mocked to succeed/fail from fixture markers (no SwiftLaTeX in Node).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createMemoryRoot } from "../../../filesystem-core/test/memfs.js";
import {
  ensureWorkspaceLayout,
  pathExists,
  readBinaryFile,
  readTextFile,
  writeTextFile,
} from "../../../filesystem-core/src/index.js";

/** Minimal valid-looking document the mock treats as compilable. */
export const KNOWN_GOOD_LATEX = String.raw`\documentclass{article}
\begin{document}
Hello from Artificer integration.
\end{document}
`;

/**
 * Intentionally broken document. Marker drives the mock compiler; the body also
 * omits \end{document} so it is clearly invalid LaTeX.
 */
export const KNOWN_BAD_LATEX = String.raw`\documentclass{article}
\begin{document}
%INTEGRATION_BAD_LATEX%
This will not compile
`;

const BAD_MARKER = "%INTEGRATION_BAD_LATEX%";

vi.mock("../../src/compile.js", () => ({
  compileLatexWithSwiftLatex: vi.fn(async (texSource) => {
    const source = String(texSource ?? "");
    if (source.includes(BAD_MARKER)) {
      const err = new Error("LaTeX compile failed (status 1)");
      err.log = "integration: known-bad fixture failed to compile\n";
      throw err;
    }
    return {
      pdf: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]), // %PDF-1.4
      log: "integration: known-good compile ok\n",
    };
  }),
}));

describe("integration: latex update + compile", () => {
  let root;
  let api;
  let pdfReadyEvents;
  let resumeUpdatedEvents;
  let unsubPdf;
  let unsubResume;
  let originalFetch;

  beforeEach(async () => {
    vi.resetModules();
    pdfReadyEvents = [];
    resumeUpdatedEvents = [];
    unsubPdf = undefined;
    unsubResume = undefined;

    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (
        String(url).includes("/schemas/") ||
        String(url).startsWith("/schemas/")
      ) {
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

    root = createMemoryRoot();
    root.name = "integration-lite";
    await ensureWorkspaceLayout(root);
    await writeTextFile(root, ["resumes", "example.tex"], KNOWN_GOOD_LATEX);
    await writeTextFile(root, ["app", ".current"], "example.tex\n");

    const { createResumeCore } = await import("../../src/index.js");
    api = await createResumeCore({ root });
    expect(api.bus).toBeTruthy();

    unsubPdf = api.bus.on("pdf:ready", (payload) => {
      pdfReadyEvents.push(payload);
    });
    unsubResume = api.bus.on("resume:updated", (payload) => {
      resumeUpdatedEvents.push(payload);
    });
  });

  afterEach(() => {
    if (typeof unsubPdf === "function") unsubPdf();
    if (typeof unsubResume === "function") unsubResume();
    globalThis.fetch = originalFetch;
  });

  it("known-good latex change compiles, writes PDF, and emits pdf:ready", async () => {
    const goodEdit = KNOWN_GOOD_LATEX.replace(
      "Hello from Artificer integration.",
      "Known good edit.",
    );

    const result = await api.updateSelectedResume(goodEdit, "example.tex");

    expect(result.compiled).toBe(true);
    expect(result.pdf).toBe("example.pdf");
    expect(result.current).toBe("example.tex");

    const stored = await readTextFile(root, ["resumes", "example.tex"]);
    expect(stored).toContain("Known good edit.");

    expect(
      await pathExists(root, ["app", "compiled", "example.pdf"], "file"),
    ).toBe(true);
    const pdf = await readBinaryFile(root, ["app", "compiled", "example.pdf"]);
    expect(String.fromCharCode(pdf[0], pdf[1], pdf[2], pdf[3])).toBe("%PDF");

    const status = await api.getPublicResumeStatus();
    expect(status.pdf).toBe("example.pdf");

    expect(resumeUpdatedEvents.some((e) => e.current === "example.tex")).toBe(
      true,
    );
    expect(
      pdfReadyEvents.some(
        (e) => e.file === "example.pdf" && e.current === "example.tex",
      ),
    ).toBe(true);
  });

  it("known-bad latex change keeps new source, clears stale PDF, and throws 422", async () => {
    await api.updateSelectedResume(KNOWN_GOOD_LATEX, "example.tex");
    expect(
      await pathExists(root, ["app", "compiled", "example.pdf"], "file"),
    ).toBe(true);
    pdfReadyEvents.length = 0;
    resumeUpdatedEvents.length = 0;

    let caught;
    try {
      await api.updateSelectedResume(KNOWN_BAD_LATEX, "example.tex");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeTruthy();
    expect(caught.status).toBe(422);
    expect(caught.body?.compiled).toBe(false);
    expect(caught.body?.error || caught.message).toMatch(/compile failed/i);
    expect(caught.body?.logTail || "").toMatch(/known-bad/i);

    const stored = await readTextFile(root, ["resumes", "example.tex"]);
    expect(stored).toContain(BAD_MARKER);

    expect(
      await pathExists(root, ["app", "compiled", "example.pdf"], "file"),
    ).toBe(false);

    const status = await api.getPublicResumeStatus();
    expect(status.current).toBe("example.tex");
    expect(status.pdf).toBeNull();

    expect(resumeUpdatedEvents.some((e) => e.current === "example.tex")).toBe(
      true,
    );
    expect(
      pdfReadyEvents.some((e) => e.file == null && e.current === "example.tex"),
    ).toBe(true);
  });
});
