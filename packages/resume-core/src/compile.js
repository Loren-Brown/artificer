/**
 * SwiftLaTeX PDF compile via PdfTeXEngine (browser assets under /swiftlatex/).
 * PdfTeXEngine itself spawns a Worker for swiftlatexpdftex.js.
 */

let engine = null;
let enginePromise = null;
let queue = Promise.resolve();

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-swiftlatex="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error(`Failed to load ${src}`)),
          { once: true },
        );
      }
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.swiftlatex = src;
    script.onload = () => {
      script.dataset.loaded = "1";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

/** Working on-demand TeX Live mirror (official texlive2.swiftlatex.com is often down). */
const TEXLIVE_ENDPOINT = "https://texlive.texlyre.org/";

async function getEngine() {
  if (engine) return engine;
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    await loadScript("/swiftlatex/PdfTeXEngine.js");
    const Engine = globalThis.PdfTeXEngine || globalThis.exports?.PdfTeXEngine;
    if (!Engine) {
      throw new Error(
        "PdfTeXEngine not found. Ensure /swiftlatex/PdfTeXEngine.js is available.",
      );
    }
    const next = new Engine();
    try {
      await next.loadEngine();
    } catch (err) {
      throw new Error(
        err?.message ||
          "SwiftLaTeX engine failed to start. Check /swiftlatex/swiftlatexpdftex.js and .wasm are served.",
      );
    }
    if (!next.isReady?.()) {
      throw new Error("SwiftLaTeX engine loaded but is not ready");
    }
    // Prefer TeXlyre mirror for .fmt + packages; worker default is also patched.
    next.setTexliveEndpoint?.(TEXLIVE_ENDPOINT);
    engine = next;
    return engine;
  })().catch((err) => {
    enginePromise = null;
    throw err;
  });
  return enginePromise;
}

/**
 * Compile LaTeX source to PDF bytes.
 * @returns {Promise<{ pdf: Uint8Array, log: string }>}
 */
export function compileLatexWithSwiftLatex(
  texSource,
  { fileName = "main.tex" } = {},
) {
  const run = async () => {
    const eng = await getEngine();
    const main = fileName || "main.tex";
    const source = String(texSource ?? "");

    // Worker processes postMessages in order; flush → write → setmain → compile.
    eng.flushCache();
    eng.writeMemFSFile(main, source);
    eng.setEngineMainFile(main);
    const result = await eng.compileLaTeX();
    const log = result.log || "";
    if ((result.status !== 0 && !result.pdf) || !result.pdf) {
      const err = new Error(
        result.status
          ? `LaTeX compile failed (status ${result.status})`
          : "LaTeX compile failed",
      );
      err.log = log;
      throw err;
    }
    const pdf =
      result.pdf instanceof Uint8Array
        ? result.pdf
        : new Uint8Array(result.pdf);
    return { pdf, log };
  };

  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
