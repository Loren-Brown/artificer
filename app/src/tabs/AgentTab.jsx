import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Modal } from "../components/Modal.jsx";
import { notifyAgentPromptSaved } from "../agentContext.js";
import * as promptApi from "../promptApi.js";

const TAB_ROLES = ["editors", "reviewers"];
const SELECTED_AGENT_STORAGE_KEY = "resume-agent-selected";
const AGENT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,63}$/;

function readCachedAgentKey() {
  try {
    return localStorage.getItem(SELECTED_AGENT_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function writeCachedAgentKey(key) {
  try {
    if (key) localStorage.setItem(SELECTED_AGENT_STORAGE_KEY, key);
    else localStorage.removeItem(SELECTED_AGENT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
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

function IconSave() {
  return (
    <svg
      className="btn-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M4 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8.828a2 2 0 0 0-.586-1.414l-4.828-4.828A2 2 0 0 0 15.172 2H4zm1 2h10v5H5V4zm2 10h10v6H7v-6z"
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

function IconFolder() {
  return (
    <svg
      className="btn-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2Z"
      />
    </svg>
  );
}

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || "");
const MOD_LABEL = IS_MAC ? "⌘" : "Ctrl+";
const HISTORY_LIMIT = 100;
const HISTORY_COALESCE_MS = 400;

function nameTakenInRole(agents, role, name, { exceptName = null } = {}) {
  const wanted = String(name ?? "").trim().toLowerCase();
  if (!wanted) return false;
  const except = exceptName ? String(exceptName).trim().toLowerCase() : null;
  return agents.some((a) => {
    if (a.role !== role) return false;
    const n = String(a.name).trim().toLowerCase();
    if (except && n === except) return false;
    return n === wanted;
  });
}

function saveAsNameWarningFor(agents, role, raw, currentName) {
  const name = String(raw ?? "").trim();
  if (!name) return "";
  if (!AGENT_NAME_RE.test(name)) {
    return "Use 1–64 chars: letters, numbers, spaces, _ . -";
  }
  if (name.toLowerCase() === String(currentName ?? "").trim().toLowerCase()) {
    return "Choose a different name than the current agent";
  }
  if (nameTakenInRole(agents, role, name)) {
    return "An agent with this name already exists for this role";
  }
  return "";
}

/**
 * Edit agent system prompts (editors / reviewers) via workspace prompt CRUD.
 */
export function AgentTab() {
  const titleId = useId();
  const menuRef = useRef(null);
  const fileMenuRef = useRef(null);
  const historyRef = useRef({ stack: [""], index: 0 });
  const contentRef = useRef("");
  const applyingHistoryRef = useRef(false);
  const coalesceTimerRef = useRef(null);
  const [agents, setAgents] = useState([]);
  const [selectedKey, setSelectedKeyState] = useState(() => readCachedAgentKey());
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createRole, setCreateRole] = useState("editors");
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [saveAsError, setSaveAsError] = useState("");
  const [saveAsNameWarning, setSaveAsNameWarning] = useState("");
  const [savingAs, setSavingAs] = useState(false);
  const [deleting, setDeleting] = useState(false);

  contentRef.current = content;

  function setSelectedKey(key) {
    setSelectedKeyState(key);
    writeCachedAgentKey(key);
  }

  function syncHistoryFlags() {
    const h = historyRef.current;
    setCanUndo(h.index > 0);
    setCanRedo(h.index < h.stack.length - 1);
  }

  function resetHistory(text) {
    if (coalesceTimerRef.current) {
      clearTimeout(coalesceTimerRef.current);
      coalesceTimerRef.current = null;
    }
    historyRef.current = { stack: [String(text ?? "")], index: 0 };
    syncHistoryFlags();
  }

  function commitHistory(text) {
    const next = String(text ?? "");
    const h = historyRef.current;
    if (h.stack[h.index] === next) {
      syncHistoryFlags();
      return;
    }
    let stack = h.stack.slice(0, h.index + 1);
    stack.push(next);
    if (stack.length > HISTORY_LIMIT) {
      stack = stack.slice(stack.length - HISTORY_LIMIT);
    }
    historyRef.current = { stack, index: stack.length - 1 };
    syncHistoryFlags();
  }

  function flushPendingHistory() {
    if (!coalesceTimerRef.current) return;
    clearTimeout(coalesceTimerRef.current);
    coalesceTimerRef.current = null;
    commitHistory(contentRef.current);
  }

  function onContentChange(next) {
    setContent(next);
    if (applyingHistoryRef.current) return;
    if (coalesceTimerRef.current) clearTimeout(coalesceTimerRef.current);
    coalesceTimerRef.current = setTimeout(() => {
      coalesceTimerRef.current = null;
      commitHistory(next);
    }, HISTORY_COALESCE_MS);
  }

  function undoEdit() {
    flushPendingHistory();
    const h = historyRef.current;
    if (h.index <= 0) return;
    h.index -= 1;
    applyingHistoryRef.current = true;
    setContent(h.stack[h.index]);
    syncHistoryFlags();
    queueMicrotask(() => {
      applyingHistoryRef.current = false;
    });
  }

  function redoEdit() {
    flushPendingHistory();
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    applyingHistoryRef.current = true;
    setContent(h.stack[h.index]);
    syncHistoryFlags();
    queueMicrotask(() => {
      applyingHistoryRef.current = false;
    });
  }

  const dirty = content !== savedContent;

  function trySelectAgent(key) {
    if (key === selectedKey) return false;
    if (dirty) {
      const ok = window.confirm("Discard unsaved changes to this agent?");
      if (!ok) return false;
    }
    setSelectedKey(key);
    return true;
  }

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    return agents.find((a) => promptApi.agentKey(a.role, a.name) === selectedKey) ?? null;
  }, [agents, selectedKey]);

  const agentsByRole = useMemo(() => {
    const map = new Map();
    for (const role of TAB_ROLES) map.set(role, []);
    for (const agent of agents) {
      if (!map.has(agent.role)) map.set(agent.role, []);
      map.get(agent.role).push(agent);
    }
    return map;
  }, [agents]);

  async function refreshList(preferKey = null) {
    const list = await promptApi.listAllAgents(TAB_ROLES);
    setAgents(list);
    const stillExists = (key) =>
      Boolean(key) &&
      list.some((a) => promptApi.agentKey(a.role, a.name) === key);
    const cached = readCachedAgentKey();
    // Prefer an explicit key (create/save-as), then current/cached — never
    // auto-pick the first agent. Missing/deleted cache → empty selection.
    const nextKey = stillExists(preferKey)
      ? preferKey
      : stillExists(selectedKey)
        ? selectedKey
        : stillExists(cached)
          ? cached
          : "";
    if (cached && !stillExists(cached)) writeCachedAgentKey("");
    setSelectedKey(nextKey);
    return { list, nextKey };
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        await refreshList();
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load agents");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!selectedKey) {
      setContent("");
      setSavedContent("");
      resetHistory("");
      return;
    }
    const { role, name } = promptApi.parseAgentKey(selectedKey);
    if (!role || !name) return;
    let cancelled = false;
    (async () => {
      try {
        setError("");
        const agent = await promptApi.getAgent(role, name);
        if (cancelled) return;
        const text = agent.content ?? "";
        setContent(text);
        setSavedContent(text);
        resetHistory(text);
      } catch (err) {
        if (cancelled) return;
        const msg = err.message || "";
        if (/\(404\)/.test(msg) || /not found/i.test(msg)) {
          writeCachedAgentKey("");
          setSelectedKeyState("");
          setContent("");
          setSavedContent("");
          resetHistory("");
          setError("");
          return;
        }
        setError(msg || "Failed to load agent");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedKey, loading]);

  useEffect(() => {
    return () => {
      if (coalesceTimerRef.current) clearTimeout(coalesceTimerRef.current);
    };
  }, []);

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

  useEffect(() => {
    if (!fileMenuOpen) return undefined;
    function onPointerDown(event) {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target)) {
        setFileMenuOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setFileMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [fileMenuOpen]);

  async function onSave() {
    if (!selected || !dirty || saving) return;
    flushPendingHistory();
    setSaving(true);
    setError("");
    try {
      const saved = await promptApi.saveAgent(
        selected.role,
        selected.name,
        contentRef.current,
      );
      const text = saved.content ?? contentRef.current;
      setContent(text);
      setSavedContent(text);
      writeCachedAgentKey(promptApi.agentKey(selected.role, selected.name));
      notifyAgentPromptSaved({ role: selected.role, name: selected.name });
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const onSaveRef = useRef(onSave);
  const undoRef = useRef(undoEdit);
  const redoRef = useRef(redoEdit);
  onSaveRef.current = onSave;
  undoRef.current = undoEdit;
  redoRef.current = redoEdit;

  useEffect(() => {
    function onKeyDown(event) {
      if (createOpen || saveAsOpen) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void onSaveRef.current();
        return;
      }
      if (key === "z" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        undoRef.current();
        return;
      }
      if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redoRef.current();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [createOpen, saveAsOpen]);

  async function onCreate(event) {
    event.preventDefault();
    const name = createName.trim();
    if (!name || creating) return;
    if (nameTakenInRole(agents, createRole, name)) {
      setCreateError("An agent with this name already exists for this role");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const created = await promptApi.createAgent({
        role: createRole,
        name,
      });
      const key = promptApi.agentKey(created.role, created.name);
      await refreshList(key);
      setCreateOpen(false);
      setCreateName("");
      setCreateRole("editors");
    } catch (err) {
      setCreateError(err.message || "Failed to create agent");
    } finally {
      setCreating(false);
    }
  }

  function confirmDiscardUnsaved() {
    if (!dirty) return true;
    return window.confirm(
      "You have unsaved changes. They will be lost if you continue before saving. Continue?",
    );
  }

  function openNewAgent() {
    setMenuOpen(false);
    if (!confirmDiscardUnsaved()) return;
    setCreateError("");
    setCreateOpen(true);
  }

  function openSaveAs() {
    if (!selected) return;
    setMenuOpen(false);
    if (!confirmDiscardUnsaved()) return;
    setSaveAsError("");
    setSaveAsNameWarning("");
    setSaveAsName(`${selected.label || selected.name} copy`);
    setSaveAsOpen(true);
  }

  async function onSaveAs(event) {
    event?.preventDefault?.();
    if (!selected || savingAs) return;
    const name = saveAsName.trim();
    const warning = saveAsNameWarningFor(
      agents,
      selected.role,
      name,
      selected.name,
    );
    if (!name || warning) {
      setSaveAsNameWarning(warning || "Enter a unique agent name");
      setSaveAsError("");
      return;
    }
    setSavingAs(true);
    setSaveAsError("");
    setSaveAsNameWarning("");
    try {
      const created = await promptApi.createAgent({
        role: selected.role,
        name,
        content,
      });
      const key = promptApi.agentKey(created.role, created.name);
      setSaveAsOpen(false);
      setSaveAsName("");
      await refreshList(key);
    } catch (err) {
      setSaveAsError(err.message || "Failed to save as");
    } finally {
      setSavingAs(false);
    }
  }

  async function onDelete() {
    if (!selected || deleting) return;
    setMenuOpen(false);
    const ok = window.confirm(
      `Delete agent “${selected.label || selected.name}”? This cannot be undone.`,
    );
    if (!ok) return;
    setDeleting(true);
    setError("");
    try {
      await promptApi.deleteAgent(selected.role, selected.name);
      const deletedKey = promptApi.agentKey(selected.role, selected.name);
      if (readCachedAgentKey() === deletedKey) writeCachedAgentKey("");
      setSelectedKeyState("");
      await refreshList();
    } catch (err) {
      setError(err.message || "Failed to delete agent");
    } finally {
      setDeleting(false);
    }
  }

  const saveAsWarning = selected
    ? saveAsNameWarningFor(agents, selected.role, saveAsName, selected.name)
    : "";

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <div className="panel-toolbar-start">
          <h2 id={titleId}>Agent</h2>
          <label className="resume-file-picker">
            <span className="visually-hidden">Selected agent</span>
            <select
              value={selectedKey}
              disabled={loading || agents.length === 0 || deleting}
              onChange={(e) => {
                trySelectAgent(e.target.value);
              }}
              data-tooltip="Selected agent"
              aria-label="Selected agent"
            >
              <option value="">
                {agents.length === 0 ? "No agents" : "Select an agent…"}
              </option>
              {TAB_ROLES.map((role) => {
                const group = agentsByRole.get(role) || [];
                if (!group.length) return null;
                return (
                  <optgroup key={role} label={role}>
                    {group.map((agent) => (
                      <option
                        key={promptApi.agentKey(agent.role, agent.name)}
                        value={promptApi.agentKey(agent.role, agent.name)}
                      >
                        {agent.label}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>
          <div className="resume-menu resume-file-menu" ref={fileMenuRef}>
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => {
                setMenuOpen(false);
                setFileMenuOpen((open) => !open);
              }}
              disabled={loading || agents.length === 0 || deleting}
              aria-haspopup="menu"
              aria-expanded={fileMenuOpen}
              data-tooltip={
                selected
                  ? `${selected.role} / ${selected.label || selected.name}`
                  : "Select agent"
              }
              aria-label={
                selected
                  ? `Agent: ${selected.label || selected.name}`
                  : "Select agent"
              }
            >
              <IconFolder />
            </button>
            {fileMenuOpen ? (
              <div
                className="resume-menu-dropdown resume-menu-dropdown-start"
                role="menu"
              >
                {TAB_ROLES.map((role) => {
                  const group = agentsByRole.get(role) || [];
                  if (!group.length) return null;
                  return (
                    <div key={role} className="resume-menu-group">
                      <div className="resume-menu-group-label" role="presentation">
                        {role}
                      </div>
                      {group.map((agent) => {
                        const key = promptApi.agentKey(agent.role, agent.name);
                        return (
                          <button
                            key={key}
                            type="button"
                            role="menuitem"
                            className={`resume-menu-item${
                              key === selectedKey ? " is-active" : ""
                            }`}
                            disabled={loading || deleting}
                            onClick={() => {
                              if (key === selectedKey) {
                                setFileMenuOpen(false);
                                return;
                              }
                              if (trySelectAgent(key)) setFileMenuOpen(false);
                            }}
                          >
                            {agent.label}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-icon"
            onClick={undoEdit}
            disabled={!selected || !canUndo || loading || deleting}
            data-tooltip={`Undo (${MOD_LABEL}Z)`}
            aria-label="Undo"
          >
            <IconUndo />
          </button>
          <button
            type="button"
            className="btn btn-icon"
            onClick={redoEdit}
            disabled={!selected || !canRedo || loading || deleting}
            data-tooltip={`Redo (${IS_MAC ? "⇧⌘Z" : "Ctrl+Y"})`}
            aria-label="Redo"
          >
            <IconRedo />
          </button>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-primary btn-icon"
            onClick={onSave}
            disabled={!selected || !dirty || saving || loading || deleting}
            data-tooltip={
              saving
                ? "Saving…"
                : dirty
                  ? `Save agent prompt (${MOD_LABEL}S)`
                  : "No changes to save"
            }
            aria-label={
              saving
                ? "Saving…"
                : dirty
                  ? `Save agent prompt (${MOD_LABEL}S)`
                  : "No changes to save"
            }
          >
            <IconSave />
          </button>
          <div className="resume-menu" ref={menuRef}>
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => {
                setFileMenuOpen(false);
                setMenuOpen((open) => !open);
              }}
              disabled={loading || deleting || savingAs}
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
                  onClick={openNewAgent}
                >
                  New agent
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="resume-menu-item"
                  disabled={!selected || savingAs}
                  onClick={openSaveAs}
                >
                  Save as…
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="resume-menu-item"
                  disabled={!selected || deleting}
                  onClick={onDelete}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="panel-body resume-preview-body">
        {error ? <div className="error-banner">{error}</div> : null}

        {loading ? (
          <p className="muted">Loading agents…</p>
        ) : selected ? (
          <textarea
            className="agent-prompt-editor"
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            spellCheck={false}
            aria-label="Agent prompt markdown"
            aria-labelledby={titleId}
          />
        ) : (
          <p className="muted">
            {agents.length === 0
              ? "Use New agent in the menu to get started."
              : "Please select an agent."}
          </p>
        )}
      </div>

      {createOpen ? (
        <Modal
          title="New agent"
          onClose={() => {
            if (!creating) setCreateOpen(false);
          }}
          footer={
            <>
              <button
                type="button"
                className="btn"
                disabled={creating}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form={`${titleId}-create`}
                className="btn btn-primary"
                disabled={
                  creating ||
                  !createName.trim() ||
                  nameTakenInRole(agents, createRole, createName)
                }
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </>
          }
        >
          <form
            id={`${titleId}-create`}
            className="stack"
            onSubmit={onCreate}
          >
            {createError ? (
              <div className="error-banner">{createError}</div>
            ) : null}
            <label className="field">
              <span>Role</span>
              <select
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value)}
                disabled={creating}
                required
              >
                {TAB_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Agent name</span>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Greg"
                disabled={creating}
                required
                autoComplete="off"
              />
            </label>
            <p className="muted">
              Creates a new agent prompt. The name is shown in the picker; file
              paths stay hidden.
            </p>
          </form>
        </Modal>
      ) : null}

      {saveAsOpen && selected ? (
        <Modal
          title="Save agent as"
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
                type="submit"
                form={`${titleId}-save-as`}
                className="btn btn-primary"
                disabled={
                  savingAs ||
                  !saveAsName.trim() ||
                  Boolean(saveAsWarning)
                }
                data-tooltip={savingAs ? "Saving…" : "Save copy"}
              >
                {savingAs ? "Saving…" : "Save"}
              </button>
            </>
          }
        >
          <form
            id={`${titleId}-save-as`}
            className="stack"
            onSubmit={onSaveAs}
          >
            {saveAsError ? (
              <div className="error-banner">{saveAsError}</div>
            ) : null}
            <p className="muted">
              Creates a new agent in <strong>{selected.role}</strong> from the
              current prompt. You will switch to the new agent after saving.
            </p>
            <div className="field">
              <label htmlFor={`${titleId}-save-as-name`}>Agent name</label>
              <input
                id={`${titleId}-save-as-name`}
                value={saveAsName}
                onChange={(e) => {
                  const next = e.target.value;
                  setSaveAsName(next);
                  setSaveAsNameWarning(
                    saveAsNameWarningFor(
                      agents,
                      selected.role,
                      next,
                      selected.name,
                    ),
                  );
                }}
                spellCheck={false}
                placeholder="e.g. Greg copy"
                disabled={savingAs}
                autoComplete="off"
                aria-label="Agent name"
                aria-invalid={Boolean(saveAsNameWarning || saveAsWarning)}
                aria-describedby={`${titleId}-save-as-warning`}
              />
              <span
                id={`${titleId}-save-as-warning`}
                className="field-warning"
                role="status"
                aria-live="polite"
              >
                {saveAsNameWarning || saveAsWarning || "\u00a0"}
              </span>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
