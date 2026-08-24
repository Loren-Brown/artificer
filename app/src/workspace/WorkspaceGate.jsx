import { BrandMark } from "../components/BrandMark.jsx";
import { useWorkspace } from "./WorkspaceContext.jsx";

export function WorkspaceGate() {
  const { phase, error, busy, openExisting, createNew } = useWorkspace();

  if (phase === "loading") {
    return (
      <div className="workspace-gate">
        <div className="workspace-gate-card">
          <h1>Artificer</h1>
          <p className="muted">Restoring workspace…</p>
        </div>
      </div>
    );
  }

  if (phase !== "gate") return null;

  return (
    <div className="workspace-gate">
      <div className="workspace-gate-card">
        <BrandMark size={58} className="brand-mark-gate" />
        <h1>Artificer</h1>
        <p className="app-brand-slogan">Build and enchant your resume</p>
        <p>
          Choose a local folder for your resumes, data, prompts, and app state.
          Everything stays on your machine.
        </p>
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="workspace-gate-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={openExisting}
          >
            {busy ? "Opening…" : "Open existing folder"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={createNew}
          >
            Create new workspace
          </button>
        </div>
        <p className="muted">
          Prefer a workspace folder with <code>prompts/</code>,{" "}
          <code>resumes/</code>, and <code>resume-data/</code> (for example{" "}
          <code>app-workspace</code>). Use Chrome or Edge and allow edit access
          when prompted.
        </p>
      </div>
    </div>
  );
}
