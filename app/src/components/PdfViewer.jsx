import { useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * PDF.js viewer with a selectable text layer.
 * @param {{ src: string, onSelectionChange?: (text: string) => void, className?: string, title?: string }} props
 */
export function PdfViewer({
  src,
  onSelectionChange,
  className = "resume-pdf-frame",
  title = "Compiled resume PDF",
}) {
  const hostRef = useRef(null);
  const onSelectionChangeRef = useRef(onSelectionChange);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !src) return undefined;

    let cancelled = false;
    let loadingTask = null;
    const renderTasks = [];

    function emitSelection() {
      const root = hostRef.current;
      if (!root) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        onSelectionChangeRef.current?.("");
        return;
      }
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        onSelectionChangeRef.current?.("");
        return;
      }
      onSelectionChangeRef.current?.(sel.toString());
    }

    function onDocSelectionChange() {
      emitSelection();
    }

    async function render() {
      host.replaceChildren();
      const pagesEl = document.createElement("div");
      pagesEl.className = "pdf-viewer-pages";
      host.appendChild(pagesEl);

      loadingTask = pdfjsLib.getDocument({ url: src });
      const pdf = await loadingTask.promise;
      if (cancelled) return;

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
        if (cancelled) return;
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const width = Math.max(host.clientWidth - 24, 320);
        const scale = width / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const pageEl = document.createElement("div");
        pageEl.className = "pdf-viewer-page";
        pageEl.dataset.pageNumber = String(pageNum);
        pageEl.style.width = `${viewport.width}px`;
        pageEl.style.height = `${viewport.height}px`;

        const canvas = document.createElement("canvas");
        canvas.setAttribute("aria-hidden", "true");
        const context = canvas.getContext("2d", { alpha: false });
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const transform =
          outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const textLayerDiv = document.createElement("div");
        textLayerDiv.className = "textLayer";
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;

        pageEl.appendChild(canvas);
        pageEl.appendChild(textLayerDiv);
        pagesEl.appendChild(pageEl);

        const renderTask = page.render({
          canvasContext: context,
          viewport,
          transform,
        });
        renderTasks.push(renderTask);
        await renderTask.promise;
        if (cancelled) return;

        const textContent = await page.getTextContent();
        if (cancelled) return;
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport,
        });
        await textLayer.render();
      }
    }

    document.addEventListener("selectionchange", onDocSelectionChange);
    host.addEventListener("mouseup", emitSelection);
    host.addEventListener("keyup", emitSelection);

    render().catch((err) => {
      if (cancelled) return;
      const message = err?.message || "Failed to load PDF";
      host.replaceChildren();
      const error = document.createElement("div");
      error.className = "pdf-viewer-error";
      error.textContent = message;
      host.appendChild(error);
      onSelectionChangeRef.current?.("");
    });

    return () => {
      cancelled = true;
      document.removeEventListener("selectionchange", onDocSelectionChange);
      host.removeEventListener("mouseup", emitSelection);
      host.removeEventListener("keyup", emitSelection);
      for (const task of renderTasks) {
        try {
          task.cancel();
        } catch {
          /* ignore */
        }
      }
      try {
        loadingTask?.destroy?.();
      } catch {
        /* ignore */
      }
      onSelectionChangeRef.current?.("");
    };
  }, [src]);

  return (
    <div
      ref={hostRef}
      className={`pdf-viewer ${className}`.trim()}
      title={title}
      role="document"
      aria-label={title}
    />
  );
}
