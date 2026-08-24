import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "../components/Modal.jsx";
import { ItemList } from "../components/ItemList.jsx";
import { LatexHighlight, LATEX_THEMES } from "../components/LatexHighlight.jsx";
import { PdfViewer } from "../components/PdfViewer.jsx";
import { Timeline, timelineFromDatedItems } from "../components/Timeline.jsx";
import { addPdfSelectionContext } from "../agentContext.js";
import { parseDate, sortByOrderAsc, withIndex, collectOrderIssues, sortByDateDesc, formatDurationPlain, mergeIssueMaps, collectEmploymentDateIssues, employmentTimelineMarkers } from "../utils.js";
import * as api from "../api.js";
import {
  CertificationForm,
  EducationForm,
  ExperienceForm,
  GeneralForm,
  ProjectForm,
  SkillCategoryForm,
  prepareCertification,
  prepareEducation,
  prepareExperience,
  prepareGeneral,
  prepareProject,
  prepareSkillCategory,
} from "../forms/forms.jsx";

function useDraft(initial) {
  const draftRef = useRef(initial);
  return {
    setDraft: (value) => {
      draftRef.current = value;
    },
    getDraft: () => draftRef.current,
  };
}

/** Stable list identity across file-index reshuffles after reorder saves. */
function itemKey(item, index) {
  if (item?.name) return `name:${item.name}`;
  if (item?.company && item?.title) {
    return `job:${item.company}:${item.title}:${item.start_date ?? ""}`;
  }
  return `idx:${index}`;
}

function FormModal({
  title,
  open,
  onClose,
  onSave,
  onDelete,
  saving,
  error,
  children,
}) {
  if (!open) return null;
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          {onDelete ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={onDelete}
              disabled={saving}
              data-tooltip="Delete this item"
            >
              Delete
            </button>
          ) : null}
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={saving}
            data-tooltip="Cancel and close"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            disabled={saving}
            data-tooltip={saving ? "Saving…" : "Save changes"}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      {error ? <div className="error-banner">{error}</div> : null}
      {children}
    </Modal>
  );
}

function IconUndo() {
  return (
    <svg
      className="btn-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8Z"
      />
    </svg>
  );
}

function IconRedo() {
  return (
    <svg
      className="btn-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22l2.37.78c1.05-3.19 4.05-5.5 7.59-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6Z"
      />
    </svg>
  );
}

function IconAddToChat() {
  return (
    <svg
      className="btn-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8.4L4 20.4V6a2 2 0 0 1 2-2Zm2 2v10.6L7.6 15H20V6H6Zm3 2.5h8v1.5H9V8.5Zm0 3.5h8V13.5H9V12Z"
      />
    </svg>
  );
}

function IconMore() {
  return (
    <svg
      className="btn-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M6 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
      />
    </svg>
  );
}

function IconPdf() {
  return (
    <svg
      className="btn-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M7 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L13.5 2H7Zm0 2h5v5h5v11H7V4Zm2 9h6v2H9v-2Zm0 4h6v2H9v-2Z"
      />
    </svg>
  );
}

function IconLatex() {
  return (
    <svg
      className="btn-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M8.1 6.2a1 1 0 0 1 .2 1.4L5.7 12l2.6 4.4a1 1 0 1 1-1.7 1.2l-3-5a1 1 0 0 1 0-1.2l3-5a1 1 0 0 1 1.5-.2Zm7.8 0a1 1 0 0 1 1.5.2l3 5a1 1 0 0 1 0 1.2l-3 5a1 1 0 1 1-1.7-1.2L18.3 12l-2.6-4.4a1 1 0 0 1 .2-1.4ZM10 17.5a1 1 0 0 1 .8-1.2l3-.6a1 1 0 0 1 .4 2l-3 .6a1 1 0 0 1-1.2-.8Z"
      />
    </svg>
  );
}

const VIEW_CYCLE = ["latex", "pdf"];

function viewIcon(viewId) {
  if (viewId === "pdf") return <IconPdf />;
  return <IconLatex />;
}

function viewLabel(viewId) {
  if (viewId === "pdf") return "Show PDF";
  return "Show LaTeX";
}

export function ResumeTab() {
  const [view, setView] = useState("pdf"); // "latex" | "pdf"
  const [latex, setLatex] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfSelection, setPdfSelection] = useState("");
  const [fileLabel, setFileLabel] = useState(null);
  const [resumeItems, setResumeItems] = useState([]);
  const [downloadBase, setDownloadBase] = useState(null);
  const [hasPdf, setHasPdf] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [saveAsError, setSaveAsError] = useState("");
  const [saveAsNameWarning, setSaveAsNameWarning] = useState("");
  const [savingAs, setSavingAs] = useState(false);
  const menuRef = useRef(null);
  const [selecting, setSelecting] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [latexTheme, setLatexTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("resume-latex-theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch {
      /* ignore */
    }
    return "dark";
  });

  function onLatexThemeChange(next) {
    setLatexTheme(next);
    try {
      localStorage.setItem("resume-latex-theme", next);
    } catch {
      /* ignore */
    }
  }

  const clearPdf = useCallback(() => {
    setHasPdf(false);
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPdfSelection("");
  }, []);

  const clearPreview = useCallback(() => {
    setLatex(null);
    setFileLabel(null);
    setDownloadBase(null);
    setCanUndo(false);
    setCanRedo(false);
    clearPdf();
  }, [clearPdf]);

  const applyHistoryMeta = useCallback((history) => {
    if (!history) return;
    setCanUndo(Boolean(history.canUndo));
    setCanRedo(Boolean(history.canRedo));
  }, []);

  const refreshHistory = useCallback(async (name) => {
    try {
      const stack = await api.getResumeHistory(name);
      applyHistoryMeta(stack);
    } catch {
      setCanUndo(false);
      setCanRedo(false);
    }
  }, [applyHistoryMeta]);

  const refreshResumeList = useCallback(async () => {
    try {
      const listed = await api.listResumes();
      setResumeItems(Array.isArray(listed?.items) ? listed.items : []);
      if (listed?.current) setFileLabel(listed.current);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const applyMeta = useCallback((payload = {}) => {
    if (payload.file) setFileLabel(payload.file);
    if (payload.current) {
      setDownloadBase(String(payload.current).replace(/\.tex$/i, ""));
      setFileLabel(payload.current);
    }
  }, []);

  const fallbackFromView = useCallback((missing) => {
    setView((prev) => {
      if (prev !== missing) return prev;
      if (missing !== "latex" && latex) return "latex";
      if (missing !== "pdf" && hasPdf) return "pdf";
      return "latex";
    });
  }, [hasPdf, latex]);

  const refreshLatex = useCallback(async (payload) => {
    try {
      setError("");
      if (payload) applyMeta(payload);
      const text = await api.getPublicResumeText();
      const status = await api.getPublicResumeStatus();
      if (!status?.current || !status?.file) {
        clearPreview();
        return;
      }
      setLatex(text);
      setFileLabel(status.file);
      setDownloadBase(status.current.replace(/\.tex$/i, ""));
      await refreshHistory(status.current);
    } catch (err) {
      if (err.status === 404) {
        setLatex(null);
        setFileLabel(null);
        setDownloadBase(null);
        setCanUndo(false);
        setCanRedo(false);
        return;
      }
      setError(err.message);
    }
  }, [applyMeta, clearPreview, refreshHistory]);

  const refreshPdf = useCallback(async (payload) => {
    try {
      setError("");
      if (payload) applyMeta(payload);
      const status = await api.getPublicResumeStatus();
      if (!status?.pdf) {
        clearPdf();
        fallbackFromView("pdf");
        return;
      }
      const url = await api.publicResumePdfPreviewUrl();
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setHasPdf(true);
      if (status.current) {
        setDownloadBase(status.current.replace(/\.tex$/i, ""));
        setFileLabel(status.current);
      }
      if (status.file) setFileLabel(status.file);
    } catch (err) {
      if (err.status === 404) {
        clearPdf();
        fallbackFromView("pdf");
        return;
      }
      setError(err.message);
    }
  }, [applyMeta, clearPdf, fallbackFromView]);

  function formatCompileError(result) {
    if (!result) return "";
    if (result.error) {
      return result.logTail
        ? `${result.error}\n${result.logTail}`
        : result.error;
    }
    return result.logTail || "";
  }

  async function applyCompileResult(result, { preferPdf = true } = {}) {
    if (result?.compiled) {
      await refreshPdf({
        file: result.pdf,
        current: result.current || result.name || fileLabel,
      });
      if (preferPdf) setView("pdf");
      return true;
    }
    clearPdf();
    setView("latex");
    const message = formatCompileError(result);
    if (message) setError(message);
    return false;
  }

  async function compileAndShowPdf() {
    setCompiling(true);
    setError("");
    try {
      const result = await api.compileSelectedResume();
      await applyCompileResult(result, { preferPdf: true });
    } catch (err) {
      setError(err.message);
      clearPdf();
      setView("latex");
    } finally {
      setCompiling(false);
    }
  }

  async function onSelectResume(name) {
    if (!name || name === fileLabel || selecting) return;
    try {
      setSelecting(true);
      setCompiling(true);
      setError("");
      const result = await api.selectResume(name);
      setFileLabel(result?.file || name);
      setDownloadBase(String(result?.name || name).replace(/\.tex$/i, ""));
      await refreshResumeList();
      await refreshLatex();
      applyHistoryMeta(result?.history);
      if (!result?.history) await refreshHistory(result?.name || name);
      await applyCompileResult(result, { preferPdf: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSelecting(false);
      setCompiling(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      try {
        setError("");
        await refreshResumeList();
        if (cancelled) return;
        const status = await api.getPublicResumeStatus();
        if (cancelled) return;
        if (!status?.current || !status?.file) {
          clearPreview();
          return;
        }
        setFileLabel(status.file);
        setDownloadBase(status.current.replace(/\.tex$/i, ""));
        await refreshLatex();
        if (cancelled) return;
        if (status.pdf) {
          await refreshPdf({ file: status.pdf, current: status.current });
          return;
        }
        // Auto-compile when a resume is selected but no PDF exists yet.
        setCompiling(true);
        try {
          const result = await api.compileSelectedResume();
          if (cancelled) return;
          await applyCompileResult(result, { preferPdf: true });
        } catch (err) {
          if (cancelled) return;
          setError(err.message);
          clearPdf();
          setView("latex");
        } finally {
          if (!cancelled) setCompiling(false);
        }
      } catch (err) {
        if (cancelled) return;
        if (err.status === 404) {
          clearPreview();
          return;
        }
        setError(err.message);
      }
    }

    initialLoad();

    const latexEs = api.subscribePublicResumeLatexWebhook((payload) => {
      if (cancelled) return;
      refreshResumeList();
      refreshLatex(payload);
    });
    const pdfEs = api.subscribePublicResumePdfWebhook((payload) => {
      if (cancelled) return;
      refreshPdf(payload).finally(() => {
        if (!cancelled) setCompiling(false);
      });
    });

    return () => {
      cancelled = true;
      latexEs.close();
      pdfEs.close();
    };
  }, [clearPdf, clearPreview, refreshLatex, refreshPdf, refreshResumeList]);

  useEffect(() => {
    if (view !== "pdf") setPdfSelection("");
  }, [view]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onPointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function openSaveAs() {
    setMenuOpen(false);
    setSaveAsError("");
    setSaveAsNameWarning("");
    const base = downloadBase || fileLabel?.replace(/\.tex$/i, "") || "resume";
    setSaveAsName(`${base}-copy.tex`);
    setSaveAsOpen(true);
  }

  function saveAsNameWarningFor(raw) {
    const name = String(raw ?? "").trim();
    if (!name) return "";
    if (!/\.tex$/i.test(name)) {
      return "File name must end with .tex";
    }
    if (!/^[A-Za-z0-9._-]+\.tex$/i.test(name)) {
      return "Use letters, numbers, dots, underscores, or hyphens ending in .tex";
    }
    if (name === fileLabel) {
      return "Choose a different name than the current resume";
    }
    return "";
  }

  function validateSaveAsName(raw) {
    const name = String(raw ?? "").trim();
    if (!name) {
      return { ok: false, warning: "Enter a file name ending in .tex" };
    }
    const warning = saveAsNameWarningFor(name);
    if (warning) return { ok: false, warning };
    return { ok: true, name };
  }

  async function onSaveAs() {
    const result = validateSaveAsName(saveAsName);
    if (!result.ok) {
      setSaveAsNameWarning(result.warning);
      setSaveAsError("");
      return;
    }
    try {
      setSavingAs(true);
      setSaveAsNameWarning("");
      setSaveAsError("");
      setError("");
      const content = latex ?? (await api.getPublicResumeText());
      await api.storeResume(result.name, content);
      setSaveAsOpen(false);
      await refreshResumeList();
    } catch (err) {
      setSaveAsError(err.message);
    } finally {
      setSavingAs(false);
    }
  }

  async function onHistoryAction(action) {
    if (historyBusy) return;
    try {
      setHistoryBusy(true);
      setCompiling(true);
      setError("");
      const result =
        action === "undo"
          ? await api.undoResume(fileLabel || undefined)
          : await api.redoResume(fileLabel || undefined);
      applyHistoryMeta(result?.history);
      await refreshLatex();
      await applyCompileResult(result, { preferPdf: false });
    } catch (err) {
      setError(err.message);
      await refreshHistory(fileLabel || undefined);
    } finally {
      setHistoryBusy(false);
      setCompiling(false);
    }
  }

  const availableViews = VIEW_CYCLE.filter((id) => {
    if (id === "latex") return Boolean(latex);
    return hasPdf;
  });
  const nextViewId =
    availableViews.length > 1
      ? availableViews[
          (Math.max(0, availableViews.indexOf(view)) + 1) % availableViews.length
        ]
      : view === "latex" && latex && !hasPdf
        ? "pdf"
        : null;
  const needsCompileForPdf = nextViewId === "pdf" && !hasPdf;

  const showPdf = view === "pdf" && pdfUrl;
  const showLatex = view === "latex" && latex;
  const hasContent = Boolean(latex || pdfUrl);
  const showCompiling = compiling || selecting || historyBusy;
  const canToggle = Boolean(nextViewId) && !showCompiling;
  const canDownloadPdf = hasPdf;
  const canDownloadLatex = Boolean(latex);
  const canSaveAs = Boolean(latex);
  const canAddPdfSelection = view === "pdf" && Boolean(pdfSelection.trim());
  const toggleLabel = needsCompileForPdf
    ? "Compile PDF"
    : nextViewId
      ? viewLabel(nextViewId)
      : "Switch view";
  const pickerOptions =
    fileLabel && !resumeItems.includes(fileLabel)
      ? [fileLabel, ...resumeItems]
      : resumeItems;
  const pickerValue = fileLabel || pickerOptions[0] || "";

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <div className="panel-toolbar-start">
          <h2>Resume</h2>
          {pickerOptions.length > 0 ? (
            <label className="resume-file-picker">
              <span className="visually-hidden">Selected resume</span>
              <select
                value={pickerValue}
                disabled={selecting || historyBusy || compiling}
                onChange={(e) => onSelectResume(e.target.value)}
                data-tooltip="Selected resume"
                aria-label="Selected resume"
              >
                {pickerOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {hasContent ? (
            <>
              <button
                type="button"
                className="btn btn-icon"
                onClick={() => onHistoryAction("undo")}
                disabled={!canUndo || historyBusy || selecting}
                data-tooltip="Undo"
                aria-label="Undo"
              >
                <IconUndo />
              </button>
              <button
                type="button"
                className="btn btn-icon"
                onClick={() => onHistoryAction("redo")}
                disabled={!canRedo || historyBusy || selecting}
                data-tooltip="Redo"
                aria-label="Redo"
              >
                <IconRedo />
              </button>
            </>
          ) : null}
        </div>
        <div className="toolbar-actions">
          {hasContent ? (
            <>
              {view === "latex" ? (
                <label className="latex-theme-picker">
                  <span className="visually-hidden">LaTeX color theme</span>
                  <select
                    value={latexTheme}
                    onChange={(e) => onLatexThemeChange(e.target.value)}
                    data-tooltip="LaTeX color theme"
                    aria-label="LaTeX color theme"
                  >
                    {LATEX_THEMES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {view === "pdf" ? (
                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={() => {
                    const text = pdfSelection.trim();
                    if (!text) return;
                    addPdfSelectionContext({ text, source: "pdf" });
                    setPdfSelection("");
                    window.getSelection()?.removeAllRanges?.();
                  }}
                  disabled={!canAddPdfSelection}
                  data-tooltip="Add PDF selection to chat"
                  aria-label="Add PDF selection to chat"
                >
                  <IconAddToChat />
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-icon"
                onClick={() => {
                  if (!nextViewId) return;
                  if (needsCompileForPdf) {
                    compileAndShowPdf();
                    return;
                  }
                  setView(nextViewId);
                }}
                disabled={!canToggle}
                data-tooltip={toggleLabel}
                aria-label={toggleLabel}
              >
                {nextViewId ? viewIcon(nextViewId) : <IconPdf />}
              </button>
              <div className="resume-menu" ref={menuRef}>
                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  data-tooltip="More actions"
                  aria-label="More actions"
                >
                  <IconMore />
                </button>
                {menuOpen ? (
                  <div className="resume-menu-dropdown" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="resume-menu-item"
                      disabled={!latex || showCompiling}
                      onClick={() => {
                        setMenuOpen(false);
                        compileAndShowPdf();
                      }}
                    >
                      {hasPdf ? "Recompile PDF" : "Compile PDF"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="resume-menu-item"
                      disabled={!canDownloadPdf || downloading}
                      onClick={async () => {
                        setMenuOpen(false);
                        try {
                          setDownloading(true);
                          setError("");
                          await api.downloadPublicResumePdf(
                            `${downloadBase || "resume"}.pdf`,
                          );
                        } catch (err) {
                          setError(err.message);
                        } finally {
                          setDownloading(false);
                        }
                      }}
                    >
                      Download PDF
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="resume-menu-item"
                      disabled={!canDownloadLatex || downloading}
                      onClick={async () => {
                        setMenuOpen(false);
                        try {
                          setDownloading(true);
                          setError("");
                          await api.downloadPublicResumeLatex(
                            `${downloadBase || "resume"}.tex`,
                          );
                        } catch (err) {
                          setError(err.message);
                        } finally {
                          setDownloading(false);
                        }
                      }}
                    >
                      Download LaTeX
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="resume-menu-item"
                      disabled={!canSaveAs || savingAs}
                      onClick={openSaveAs}
                    >
                      Save as…
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div
        className={`panel-body resume-preview-body${showCompiling ? " is-compiling" : ""}`}
      >
        {error ? <div className="error-banner">{error}</div> : null}
        {showCompiling ? (
          <div className="resume-compile-overlay" role="status" aria-live="polite">
            <span className="resume-compile-spinner" aria-hidden="true" />
            <span>Compiling…</span>
          </div>
        ) : null}
        {showPdf ? (
          <PdfViewer
            className="resume-pdf-frame"
            title="Compiled resume PDF"
            src={pdfUrl}
            onSelectionChange={setPdfSelection}
          />
        ) : null}
        {showLatex ? (
          <LatexHighlight code={latex} theme={latexTheme} />
        ) : null}
      </div>
      {saveAsOpen ? (
        <Modal
          title="Save resume as"
          onClose={() => {
            if (!savingAs) setSaveAsOpen(false);
          }}
          footer={
            <>
              <button
                type="button"
                className="btn"
                onClick={() => setSaveAsOpen(false)}
                disabled={savingAs}
                data-tooltip="Cancel and close"
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onSaveAs}
                disabled={
                  savingAs ||
                  !saveAsName.trim() ||
                  Boolean(saveAsNameWarningFor(saveAsName))
                }
                data-tooltip={savingAs ? "Saving…" : "Save copy"}
              >
                {savingAs ? "Saving…" : "Save"}
              </button>
            </>
          }
        >
          {saveAsError ? <div className="error-banner">{saveAsError}</div> : null}
          <p className="muted">
            Creates a new <code>.tex</code> file from the current resume. The
            viewer stays on <strong>{fileLabel || "the selected file"}</strong>.
          </p>
          <div className="field">
            <label htmlFor="save-as-filename">File name</label>
            <input
              id="save-as-filename"
              value={saveAsName}
              onChange={(e) => {
                const next = e.target.value;
                setSaveAsName(next);
                setSaveAsNameWarning(saveAsNameWarningFor(next));
              }}
              spellCheck={false}
              placeholder="my-resume.tex"
              disabled={savingAs}
              aria-label="File name"
              aria-invalid={Boolean(saveAsNameWarning)}
              aria-describedby="save-as-name-warning"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSaveAs();
                }
              }}
            />
            <span
              id="save-as-name-warning"
              className="field-warning"
              role="status"
              aria-live="polite"
            >
              {saveAsNameWarning || "\u00a0"}
            </span>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function GeneralTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const skipDirtyRef = useRef(true);
  const { setDraft, getDraft } = useDraft(null);

  const load = useCallback(async () => {
    try {
      setError("");
      const next = await api.getGeneral();
      setData(next);
      setDraft(next);
      skipDirtyRef.current = true;
      setDirty(false);
      setFormKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    try {
      setSaving(true);
      setSaveError("");
      const prepared = prepareGeneral(getDraft());
      await api.putGeneral(prepared);
      await load();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>General</h2>
        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={!data || !dirty || saving}
            data-tooltip={dirty ? "Save profile" : "No changes to save"}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <div className="panel-body">
        {error ? <div className="error-banner">{error}</div> : null}
        {saveError ? <div className="error-banner">{saveError}</div> : null}
        {data ? (
          <GeneralForm
            key={formKey}
            initial={data}
            onChange={(next) => {
              setDraft(next);
              if (skipDirtyRef.current) {
                skipDirtyRef.current = false;
                return;
              }
              setDirty(true);
            }}
          />
        ) : !error ? (
          <p className="muted">Loading…</p>
        ) : null}
      </div>
    </div>
  );
}

function ArrayTab({
  title,
  type,
  addLabel,
  Form,
  prepare,
  listLabel,
  listPrivateLabel,
  listMeta,
  sortDate,
  timelineConfig,
  timelineMarkers = [],
  collectExtraIssues,
}) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [mode, setMode] = useState(null); // { kind: 'create'|'edit', index?, item? }
  const [saving, setSaving] = useState(false);
  const { setDraft, getDraft } = useDraft(null);

  const load = useCallback(async () => {
    try {
      setError("");
      const res = await api.listItems(type);
      setItems(res.items ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = sortByOrderAsc(withIndex(items));
  const orderIssues = collectOrderIssues(rows, sortDate);
  const extraIssues = collectExtraIssues?.(rows) ?? new Map();
  const rowIssues = mergeIssueMaps(orderIssues, extraIssues);

  async function save() {
    try {
      setSaving(true);
      setModalError("");
      const prepared = prepare(getDraft());
      if (mode.kind === "create") {
        await api.createItem(type, prepared);
      } else {
        await api.updateItem(type, mode.index, {
          ...prepared,
          order: mode.item?.order ?? prepared.order,
        });
      }
      setMode(null);
      await load();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!mode || mode.kind !== "edit") return;
    if (!window.confirm("Delete this item?")) return;
    try {
      setSaving(true);
      setModalError("");
      await api.deleteItem(type, mode.index);
      setMode(null);
      await load();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function persistReorder(displayRows) {
    const indexes = displayRows.map((row) => row.index);
    // Optimistic: update order fields so the list doesn't snap back while saving.
    setItems((current) => {
      const next = current.map((item) => ({ ...item }));
      displayRows.forEach((row, order) => {
        if (next[row.index]) {
          next[row.index] = { ...next[row.index], ...row.item, order };
        }
      });
      return next;
    });

    try {
      setError("");
      const res = await api.reorderItems(type, indexes);
      setItems(res.items ?? []);
    } catch (err) {
      setError(err.message);
      await load();
    }
  }

  async function reorderByDate() {
    if (!sortDate) return;
    const byDate = sortByDateDesc(withIndex(items), sortDate);
    await persistReorder(byDate);
  }

  const timelineEntries = timelineConfig
    ? timelineFromDatedItems(rows, timelineConfig)
    : [];

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>{title}</h2>
        <div className="toolbar-actions">
          {sortDate ? (
            <button
              type="button"
              className="btn"
              onClick={reorderByDate}
              data-tooltip="Re-order list by date (newest first)"
            >
              Re-order by date
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setDraft({});
              setModalError("");
              setMode({ kind: "create" });
            }}
            data-tooltip={addLabel}
          >
            {addLabel}
          </button>
        </div>
      </div>
      <div className="panel-body">
        {error ? <div className="error-banner">{error}</div> : null}
        <ItemList
          onReorder={(nextEntries) => {
            const nextRows = nextEntries.map((entry) => ({
              item: entry._item,
              index: entry._index,
            }));
            void persistReorder(nextRows);
          }}
          items={rows.map(({ item, index }) => ({
            key: itemKey(item, index),
            title: listLabel(item),
            privateTitle: listPrivateLabel?.(item) || undefined,
            meta: listMeta(item),
            issues: rowIssues.get(index) ?? [],
            _item: item,
            _index: index,
            onClick: () => {
              setDraft(item);
              setModalError("");
              setMode({ kind: "edit", index, item });
            },
          }))}
        />
        <Timeline entries={timelineEntries} markers={timelineMarkers} />
      </div>
      <FormModal
        title={mode?.kind === "create" ? addLabel : `Edit ${title.slice(0, -1)}`}
        open={Boolean(mode)}
        onClose={() => setMode(null)}
        onSave={save}
        onDelete={mode?.kind === "edit" ? remove : undefined}
        saving={saving}
        error={modalError}
      >
        {mode ? (
          <Form
            key={`${mode.kind}-${mode.index ?? "new"}`}
            initial={mode.kind === "edit" ? mode.item : undefined}
            onChange={setDraft}
          />
        ) : null}
      </FormModal>
    </div>
  );
}

export function ExperienceTab() {
  return (
    <ArrayTab
      title="Professional Experience"
      type="experience"
      addLabel="Add experience"
      Form={ExperienceForm}
      prepare={prepareExperience}
      listLabel={(item) => `${item.company} — ${item.title}`}
      listMeta={(item) => {
        const range = `${item.start_date ?? "?"}${item.current ? " – present" : item.end_date ? ` – ${item.end_date}` : ""}`;
        const duration = formatDurationPlain(item.start_date, item.end_date, {
          ongoing: Boolean(item.current),
        });
        return duration ? `${range} · ${duration}` : range;
      }}
      sortDate={(item) => parseDate(item.start_date)}
      timelineConfig={{
        label: (item) => `${item.company} — ${item.title}`,
        startKey: "start_date",
        endKey: "end_date",
        currentKey: "current",
      }}
    />
  );
}

export function EducationTab() {
  return (
    <ArrayTab
      title="Education"
      type="education"
      addLabel="Add education"
      Form={EducationForm}
      prepare={prepareEducation}
      listLabel={(item) => item.name}
      listMeta={(item) =>
        [item.degree, item.graduation_date || item.end_date || item.start_date]
          .filter(Boolean)
          .join(" · ")
      }
      sortDate={(item) =>
        parseDate(item.end_date) ??
        parseDate(item.start_date) ??
        parseDate(item.graduation_date)
      }
      timelineConfig={{
        label: (item) => item.name,
        startKey: "start_date",
        endKey: "end_date",
      }}
    />
  );
}

export function ProjectsTab() {
  const [experience, setExperience] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api
      .listItems("experience")
      .then((res) => {
        if (!cancelled) setExperience(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setExperience([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const timelineMarkers = useMemo(
    () => employmentTimelineMarkers(experience),
    [experience],
  );

  const collectExtraIssues = useCallback(
    (rows) => {
      const issues = new Map();
      for (const { item, index } of rows) {
        const messages = collectEmploymentDateIssues(item, experience);
        if (messages.length) issues.set(index, messages);
      }
      return issues;
    },
    [experience],
  );

  return (
    <ArrayTab
      title="Projects"
      type="projects"
      addLabel="Add project"
      Form={ProjectForm}
      prepare={prepareProject}
      listLabel={(item) => item.name}
      listPrivateLabel={(item) => item._name?.trim() || ""}
      listMeta={(item) => {
        const range = [
          item.company || item.school,
          item.start_date,
          item.current_project ? "present" : item.end_date,
        ]
          .filter(Boolean)
          .join(" · ");
        const duration = formatDurationPlain(item.start_date, item.end_date, {
          ongoing: Boolean(item.current_project),
        });
        return duration ? `${range} · ${duration}` : range;
      }}
      sortDate={(item) => parseDate(item.start_date)}
      timelineConfig={{
        label: (item) => item.name,
        startKey: "start_date",
        endKey: "end_date",
        currentKey: "current_project",
      }}
      timelineMarkers={timelineMarkers}
      collectExtraIssues={collectExtraIssues}
    />
  );
}

export function CertificationsTab() {
  return (
    <ArrayTab
      title="Certifications"
      type="certifications"
      addLabel="Add certification"
      Form={CertificationForm}
      prepare={prepareCertification}
      listLabel={(item) => item.name}
      listMeta={(item) =>
        [item.issuer, item.issued_date, item.expired_date]
          .filter(Boolean)
          .join(" · ")
      }
      sortDate={(item) => parseDate(item.issued_date)}
      timelineConfig={{
        label: (item) => item.name,
        startKey: "issued_date",
        endKey: "expired_date",
      }}
    />
  );
}

export function SkillsTab() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [mode, setMode] = useState(null);
  const [saving, setSaving] = useState(false);
  const { setDraft, getDraft } = useDraft(null);

  const load = useCallback(async () => {
    try {
      setError("");
      const res = await api.listSkillCategories();
      setItems(res.items ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = sortByOrderAsc(withIndex(items));

  async function save() {
    try {
      setSaving(true);
      setModalError("");
      const prepared = prepareSkillCategory(getDraft());
      if (mode.kind === "create") {
        await api.createSkillCategory(prepared);
      } else {
        await api.updateSkillCategory(mode.index, {
          ...prepared,
          order: mode.item?.order,
        });
      }
      setMode(null);
      await load();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!mode || mode.kind !== "edit") return;
    if (!window.confirm("Delete this skill category?")) return;
    try {
      setSaving(true);
      setModalError("");
      await api.deleteSkillCategory(mode.index);
      setMode(null);
      await load();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function persistReorder(displayRows) {
    const indexes = displayRows.map((row) => row.index);
    setItems((current) => {
      const next = current.map((item) => ({ ...item }));
      displayRows.forEach((row, order) => {
        if (next[row.index]) {
          next[row.index] = { ...next[row.index], ...row.item, order };
        }
      });
      return next;
    });

    try {
      setError("");
      const res = await api.reorderSkillCategories(indexes);
      setItems(res.items ?? []);
    } catch (err) {
      setError(err.message);
      await load();
    }
  }

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Skills</h2>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setDraft({ name: "", items: [{ name: "", tags: [] }] });
            setModalError("");
            setMode({ kind: "create" });
          }}
          data-tooltip="Add category"
        >
          Add category
        </button>
      </div>
      <div className="panel-body">
        {error ? <div className="error-banner">{error}</div> : null}
        <ItemList
          onReorder={(nextEntries) => {
            void persistReorder(
              nextEntries.map((entry) => ({
                item: entry._item,
                index: entry._index,
              })),
            );
          }}
          items={rows.map(({ item, index }) => ({
            key: itemKey(item, index),
            title: item.name,
            meta: `${item.items?.length ?? 0} skill(s)`,
            _item: item,
            _index: index,
            onClick: () => {
              setDraft(item);
              setModalError("");
              setMode({ kind: "edit", index, item });
            },
          }))}
        />
      </div>
      <FormModal
        title={mode?.kind === "create" ? "Add category" : "Edit category"}
        open={Boolean(mode)}
        onClose={() => setMode(null)}
        onSave={save}
        onDelete={mode?.kind === "edit" ? remove : undefined}
        saving={saving}
        error={modalError}
      >
        {mode ? (
          <SkillCategoryForm
            key={`${mode.kind}-${mode.index ?? "new"}`}
            initial={mode.kind === "edit" ? mode.item : undefined}
            onChange={setDraft}
          />
        ) : null}
      </FormModal>
    </div>
  );
}
