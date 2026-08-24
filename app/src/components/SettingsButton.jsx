import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Modal } from "./Modal.jsx";
import {
  CORS_FRIENDLY_PROVIDERS,
  clearByokConfig,
  loadByokConfig,
  saveByokConfig,
} from "@resume/agent-core";
import {
  LATEX_THEMES,
  loadLatexTheme,
  saveLatexTheme,
} from "./latexThemes.js";
import { clearBrowserAppCache } from "../browserSupport.js";

function IconSettings() {
  return (
    <svg
      className="btn-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.07 7.07 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.7a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
      />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg
      className="btn-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M9 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V7Zm2 0v10h8V7h-8ZM5 9a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8v-2H5V9Z"
      />
    </svg>
  );
}

function emptyByokForm() {
  const saved = loadByokConfig();
  const provider =
    CORS_FRIENDLY_PROVIDERS.find((p) => p.id === saved?.provider) ||
    CORS_FRIENDLY_PROVIDERS[0];
  return {
    provider: provider.id,
    apiKey: saved?.apiKey || "",
    model: saved?.model || provider.defaultModel,
    baseUrl: saved?.baseUrl || "",
  };
}

/**
 * Header settings: change workspace + edit BYOK config.
 */
export function SettingsButton({
  workspaceName = "",
  onChangeWorkspace,
  isLite = false,
  showTrigger = true,
  open: openProp,
  onOpenChange,
}) {
  const formIdRaw = useId();
  const formId = `settings${formIdRaw.replace(/:/g, "")}`;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? Boolean(openProp) : uncontrolledOpen;
  const [byokForm, setByokForm] = useState(emptyByokForm);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [revealKey, setRevealKey] = useState(false);
  const [latexTheme, setLatexTheme] = useState(loadLatexTheme);

  const selectedProvider = useMemo(
    () =>
      CORS_FRIENDLY_PROVIDERS.find((p) => p.id === byokForm.provider) ||
      CORS_FRIENDLY_PROVIDERS[0],
    [byokForm.provider],
  );

  function setOpen(next) {
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setByokForm(emptyByokForm());
      setLatexTheme(loadLatexTheme());
      setError("");
      setCopyStatus("");
      setRevealKey(false);
    }
    wasOpenRef.current = open;
  }, [open]);

  function openSettings() {
    setOpen(true);
  }

  function closeSettings() {
    setOpen(false);
  }

  async function onCopyKey() {
    const key = byokForm.apiKey.trim();
    if (!key) {
      setCopyStatus("No key to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(key);
      setCopyStatus("Copied");
      window.setTimeout(() => setCopyStatus(""), 2000);
    } catch {
      setCopyStatus("Copy failed");
    }
  }

  function onSaveByok(event) {
    event.preventDefault();
    const apiKey = byokForm.apiKey.trim();
    const model = byokForm.model.trim();
    const baseUrl = byokForm.baseUrl.trim();
    if (!apiKey || !model) {
      setError("API key and model are required");
      return;
    }
    if (selectedProvider.needsBaseUrl && !baseUrl) {
      setError("Base URL is required for OpenAI-compatible providers");
      return;
    }
    saveByokConfig({
      provider: selectedProvider.id,
      apiKey,
      model,
      baseUrl: selectedProvider.needsBaseUrl ? baseUrl : undefined,
    });
    setError("");
    closeSettings();
  }

  function onClearByok() {
    clearByokConfig();
    setByokForm(emptyByokForm());
    setError("");
    setCopyStatus("");
  }

  async function onClearCache() {
    const ok = window.confirm(
      "Clear cache and reset Artificer?\n\nThis removes all saved browser data for this site (settings, API key, last workspace link, and UI preferences) and reloads the app as if you have never visited before.\n\nFiles in your workspace folder on disk are not deleted.",
    );
    if (!ok) return;
    closeSettings();
    await clearBrowserAppCache();
    window.location.reload();
  }

  function onChangeWorkspaceClick() {
    closeSettings();
    void onChangeWorkspace?.();
  }

  return (
    <>
      {showTrigger ? (
        <button
          type="button"
          className="btn btn-icon app-header-action settings-trigger-desktop"
          onClick={openSettings}
          data-tooltip="Settings"
          aria-label="Settings"
        >
          <IconSettings />
        </button>
      ) : null}

      {open ? (
        <Modal
          title="Settings"
          onClose={closeSettings}
          footer={
            <>
              <button
                type="button"
                className="btn"
                onClick={closeSettings}
                data-tooltip="Close without saving LLM settings"
              >
                Cancel
              </button>
              <button
                type="submit"
                form={formId}
                className="btn btn-primary"
                data-tooltip="Save LLM settings"
              >
                Save LLM settings
              </button>
            </>
          }
        >
          <div className="stack settings-modal">
            <section className="settings-section">
              <h4>Workspace</h4>
              {isLite ? (
                <p className="muted">
                  Lite mode uses an in-memory seed workspace. Changes are not
                  written to disk and are lost when you refresh.
                </p>
              ) : (
                <>
                  <p className="muted">
                    {workspaceName
                      ? `Current folder: ${workspaceName}`
                      : "Your resume data stays in a local folder you choose."}
                  </p>
                  <button
                    type="button"
                    className="btn"
                    onClick={onChangeWorkspaceClick}
                    data-tooltip="Leave this folder and pick another"
                  >
                    Change workspace…
                  </button>
                </>
              )}
            </section>

            <section className="settings-section">
              <h4>LaTeX preview</h4>
              <p className="muted">
                Color theme for the resume LaTeX source view.
              </p>
              <div className="field">
                <label htmlFor={`${formId}-latex-theme`}>Style</label>
                <select
                  id={`${formId}-latex-theme`}
                  value={latexTheme}
                  onChange={(e) => {
                    const next = saveLatexTheme(e.target.value);
                    setLatexTheme(next);
                  }}
                  data-tooltip="LaTeX color theme"
                  aria-label="LaTeX color theme"
                >
                  {LATEX_THEMES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="settings-section">
              <h4>LLM (bring your own key)</h4>
              <p className="muted">
                Keys stay in this browser only. Use a CORS-friendly provider.
              </p>
              <form id={formId} className="stack" onSubmit={onSaveByok}>
                {error ? <div className="error-banner">{error}</div> : null}
                <div className="field">
                  <label htmlFor={`${formId}-provider`}>Provider</label>
                  <select
                    id={`${formId}-provider`}
                    value={byokForm.provider}
                    onChange={(e) => {
                      const next =
                        CORS_FRIENDLY_PROVIDERS.find(
                          (p) => p.id === e.target.value,
                        ) || CORS_FRIENDLY_PROVIDERS[0];
                      setByokForm((prev) => ({
                        ...prev,
                        provider: next.id,
                        model: next.defaultModel,
                        baseUrl: next.needsBaseUrl ? prev.baseUrl : "",
                      }));
                    }}
                  >
                    {CORS_FRIENDLY_PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="muted">{selectedProvider.hint}</p>
                {selectedProvider.needsBaseUrl ? (
                  <div className="field">
                    <label htmlFor={`${formId}-base-url`}>Base URL</label>
                    <input
                      id={`${formId}-base-url`}
                      type="url"
                      value={byokForm.baseUrl}
                      onChange={(e) =>
                        setByokForm((prev) => ({
                          ...prev,
                          baseUrl: e.target.value,
                        }))
                      }
                      placeholder="https://your-proxy.example/v1"
                      autoComplete="off"
                      aria-label="Base URL"
                    />
                  </div>
                ) : null}
                <div className="field">
                  <label htmlFor={`${formId}-api-key`}>API key</label>
                  <div className="settings-secret-row">
                    <input
                      id={`${formId}-api-key`}
                      type={revealKey ? "text" : "password"}
                      value={byokForm.apiKey}
                      onChange={(e) =>
                        setByokForm((prev) => ({
                          ...prev,
                          apiKey: e.target.value,
                        }))
                      }
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="API key"
                    />
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setRevealKey((v) => !v)}
                      data-tooltip={revealKey ? "Hide key" : "Show key"}
                      aria-label={revealKey ? "Hide API key" : "Show API key"}
                      aria-pressed={revealKey}
                    >
                      {revealKey ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon"
                      onClick={() => void onCopyKey()}
                      data-tooltip="Copy API key to clipboard"
                      aria-label="Copy API key to clipboard"
                      disabled={!byokForm.apiKey.trim()}
                    >
                      <IconCopy />
                    </button>
                  </div>
                  {copyStatus ? (
                    <p className="muted settings-copy-status" role="status">
                      {copyStatus}
                    </p>
                  ) : null}
                </div>
                <div className="field">
                  <label htmlFor={`${formId}-model`}>Model</label>
                  <input
                    id={`${formId}-model`}
                    type="text"
                    value={byokForm.model}
                    onChange={(e) =>
                      setByokForm((prev) => ({
                        ...prev,
                        model: e.target.value,
                      }))
                    }
                    spellCheck={false}
                    aria-label="Model"
                  />
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={onClearByok}
                  data-tooltip="Remove saved key from this browser"
                >
                  Clear saved key
                </button>
              </form>
            </section>

            <section className="settings-section">
              <h4>Browser data</h4>
              <p className="muted">
                Clears settings, saved API key, workspace link, and other
                preferences in this browser, then reloads as a first visit.
                Does not delete files on disk.
              </p>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void onClearCache()}
                data-tooltip="Reset Artificer as if you have never visited"
              >
                Clear cache…
              </button>
            </section>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
