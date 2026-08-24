import { useEffect, useId, useRef, useState } from "react";
import { DraggablePanel } from "./DraggablePanel.jsx";
import { Modal } from "./Modal.jsx";
import * as agentApi from "../agentApi.js";
import * as promptApi from "../promptApi.js";
import {
  CORS_FRIENDLY_PROVIDERS,
  isByokConfigured,
  loadByokConfig,
  saveByokConfig,
} from "@resume/agent-core";
import {
  buildMessageWithContext,
  subscribeAgentContext,
  subscribeAgentPromptSaved,
  subscribeOpenAgentChat,
} from "../agentContext.js";

function IconChat() {
  return (
    <svg className="btn-icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8.4L4 20.4V6a2 2 0 0 1 2-2Zm2 2v10.6L7.6 15H20V6H6Z"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg className="btn-icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M6.7 5.3a1 1 0 0 0-1.4 1.4L10.58 12 5.3 17.3a1 1 0 1 0 1.4 1.4L12 13.42l5.3 5.28a1 1 0 0 0 1.4-1.4L13.42 12l5.28-5.3a1 1 0 0 0-1.4-1.4L12 10.58 6.7 5.3Z"
      />
    </svg>
  );
}

/** Activity / tool-log glyph for show/hide working output. */
function IconWorkLog() {
  return (
    <svg className="btn-icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13ZM6 7v2h2V7H6Zm4 0v2h8V7h-8ZM6 11v2h2v-2H6Zm4 0v2h8v-2h-8ZM6 15v2h2v-2H6Zm4 0v2h8v-2h-8Z"
      />
    </svg>
  );
}

function chipSnippet(text, max = 72) {
  const oneLine = String(text ?? "").replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
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
 * Floating resume agent chat (in-browser BYOK + tools).
 */
export function AgentChat() {
  const [open, setOpen] = useState(false);
  const [byokOpen, setByokOpen] = useState(false);
  const [byokForm, setByokForm] = useState(emptyByokForm);
  const [byokError, setByokError] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [contextChips, setContextChips] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [agentMeta, setAgentMeta] = useState({ role: null, name: null });
  const [busy, setBusy] = useState(false);
  const [showWorkingOutput, setShowWorkingOutput] = useState(false);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [reinitToast, setReinitToast] = useState(null);
  const listRef = useRef(null);
  const abortRef = useRef(null);
  const conversationRef = useRef({ conversationId: null, role: null, name: null });
  const toastTimerRef = useRef(null);
  const titleId = useId();

  conversationRef.current = {
    conversationId,
    role: agentMeta.role,
    name: agentMeta.name,
  };

  const selectedProvider =
    CORS_FRIENDLY_PROVIDERS.find((p) => p.id === byokForm.provider) ||
    CORS_FRIENDLY_PROVIDERS[0];

  function dismissReinitToast() {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setReinitToast(null);
  }

  function showReinitToast({ role, name }) {
    const label = name ? `${role} / ${name}` : role;
    dismissReinitToast();
    setReinitToast({
      id: Date.now(),
      message: `Prompt for ${label} was saved. Re-initialize the agent chat to use the updated prompt.`,
    });
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null;
      setReinitToast(null);
    }, 6000);
  }

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const unsubContext = subscribeAgentContext((event) => {
      if (event?.type === "add" && event.chip) {
        setContextChips((prev) => [...prev, event.chip]);
      }
    });
    const unsubOpen = subscribeOpenAgentChat(() => {
      openAgentPanel();
    });
    const unsubSaved = subscribeAgentPromptSaved(({ role, name }) => {
      const active = conversationRef.current;
      if (!active.conversationId || !active.role) return;
      if (active.role !== role) return;
      const a = String(active.name ?? "").toLowerCase();
      const b = String(name ?? "").toLowerCase();
      if (a !== b) return;
      showReinitToast({ role, name });
    });
    return () => {
      unsubContext();
      unsubOpen();
      unsubSaved();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable pub/sub; uses refs
  }, []);

  useEffect(() => {
    if (!setupOpen) return;
    let cancelled = false;
    (async () => {
      try {
        setSetupError("");
        const nextRoles = await promptApi.listRoles();
        if (cancelled) return;
        setRoles(nextRoles);
        const initialRole =
          selectedRole && nextRoles.includes(selectedRole)
            ? selectedRole
            : nextRoles[0] || "";
        setSelectedRole(initialRole);
      } catch (err) {
        if (!cancelled) setSetupError(err.message || "Failed to load roles");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setupOpen]);

  useEffect(() => {
    if (!setupOpen || !selectedRole) {
      setAgents([]);
      setSelectedName("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const nextAgents = await promptApi.listAgents(selectedRole);
        if (cancelled) return;
        setAgents(nextAgents);
        setSelectedName(nextAgents[0] || "");
      } catch (err) {
        if (!cancelled) {
          setAgents([]);
          setSelectedName("");
          setSetupError(err.message || "Failed to load agents");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setupOpen, selectedRole]);

  function continueAfterByok() {
    setOpen(true);
    if (!conversationRef.current.conversationId) setSetupOpen(true);
  }

  function openAgentPanel() {
    if (!isByokConfigured()) {
      setByokForm(emptyByokForm());
      setByokError("");
      setByokOpen(true);
      return;
    }
    continueAfterByok();
  }

  function openByokSettings() {
    setByokForm(emptyByokForm());
    setByokError("");
    setByokOpen(true);
  }

  function onSkipByok() {
    setByokOpen(false);
    setByokError("");
    // Skip → do not open the agent panel
  }

  function onSaveByok(event) {
    event.preventDefault();
    const provider = selectedProvider;
    const apiKey = byokForm.apiKey.trim();
    const model = byokForm.model.trim();
    const baseUrl = byokForm.baseUrl.trim();
    if (!apiKey || !model) {
      setByokError("API key and model are required");
      return;
    }
    if (provider.needsBaseUrl && !baseUrl) {
      setByokError("Base URL is required for OpenAI-compatible providers");
      return;
    }
    saveByokConfig({
      provider: provider.id,
      apiKey,
      model,
      baseUrl: provider.needsBaseUrl ? baseUrl : undefined,
    });
    setByokOpen(false);
    setByokError("");
    continueAfterByok();
  }

  async function startConversation({ role, name }) {
    setSetupBusy(true);
    setSetupError("");
    setError("");
    try {
      await promptApi.activateAgent({ role, name: name || null });
      const created = await agentApi.createConversation({
        role,
        name: name || null,
      });
      setConversationId(created.conversationId);
      setAgentMeta({
        role: created.role ?? role,
        name: created.name ?? name ?? null,
      });
      setSetupOpen(false);
      setMessages([]);
    } catch (err) {
      setSetupError(err.message || "Failed to start agent");
    } finally {
      setSetupBusy(false);
    }
  }

  async function onConfirmSetup(event) {
    event.preventDefault();
    if (!selectedRole || setupBusy) return;
    if (agents.length > 0 && !selectedName) {
      setSetupError("Select an agent name");
      return;
    }
    await startConversation({
      role: selectedRole,
      name: agents.length > 0 ? selectedName : null,
    });
  }

  function dismissChip(id) {
    setContextChips((prev) => prev.filter((chip) => chip.id !== id));
  }

  async function onSend(event) {
    event.preventDefault();
    const text = input.trim();
    if ((!text && contextChips.length === 0) || busy) return;
    if (!text) return;
    if (!conversationId) {
      setSetupOpen(true);
      setError("Choose an agent role and name before chatting.");
      return;
    }

    const chips = contextChips;
    const outbound = buildMessageWithContext(text, chips);
    const displayText =
      chips.length > 0
        ? `${chips.map((c) => `[PDF] ${chipSnippet(c.text, 40)}`).join(" · ")}\n${text}`
        : text;

    setError("");
    setInput("");
    setContextChips([]);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text: displayText },
    ]);

    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", text: "", tools: [] },
    ]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await agentApi.streamChat({
        conversationId,
        message: outbound,
        signal: controller.signal,
        onEvent: (eventName, data) => {
          if (eventName === "text" && data?.text) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, text: `${m.text || ""}${data.text}` }
                  : m,
              ),
            );
          }
          if (eventName === "tool" && data?.name) {
            const label = `${data.name}${data.status ? ` (${data.status})` : ""}`;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      tools: [...(m.tools || []), label],
                    }
                  : m,
              ),
            );
          }
          if (eventName === "error" && data?.message) {
            setError(data.message);
          }
          if (eventName === "status" && data?.conversationId) {
            setConversationId(data.conversationId);
          }
          if (eventName === "done" && data?.conversationId) {
            setConversationId(data.conversationId);
          }
        },
      });
      if (result?.conversationId) setConversationId(result.conversationId);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Chat failed");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.text
              ? { ...m, text: "(No response)" }
              : m,
          ),
        );
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  async function closeAgentPanel() {
    abortRef.current?.abort();
    if (conversationId) {
      await agentApi.deleteConversation(conversationId);
    }
    setConversationId(null);
    setAgentMeta({ role: null, name: null });
    setMessages([]);
    setContextChips([]);
    setError("");
    setBusy(false);
    setSetupOpen(false);
    setOpen(false);
  }

  const agentLabel = agentMeta.role
    ? `${agentMeta.role}${agentMeta.name ? ` / ${agentMeta.name}` : ""}`
    : null;

  return (
    <>
      {reinitToast ? (
        <div
          className="app-toast"
          role="status"
          aria-live="polite"
          key={reinitToast.id}
        >
          <p className="app-toast-message">{reinitToast.message}</p>
          <button
            type="button"
            className="btn btn-icon app-toast-dismiss"
            onClick={dismissReinitToast}
            aria-label="Dismiss notification"
            data-tooltip="Dismiss"
          >
            <IconClose />
          </button>
        </div>
      ) : null}

      {!open ? (
        <button
          type="button"
          className="btn btn-icon agent-chat-launcher"
          onClick={openAgentPanel}
          data-tooltip="Resume agent"
          aria-label="Open resume agent chat"
        >
          <IconChat />
        </button>
      ) : null}

      <DraggablePanel open={open} className="agent-chat-panel">
        <div className="agent-chat-header" data-drag-handle>
          <div className="agent-chat-title-block">
            <h2 id={titleId}>Resume agent</h2>
            {agentLabel ? (
              <p className="muted agent-chat-agent-meta">{agentLabel}</p>
            ) : null}
          </div>
          <div className="agent-chat-header-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={openByokSettings}
              data-tooltip="LLM provider settings"
            >
              LLM
            </button>
            <button
              type="button"
              className={`btn btn-icon${showWorkingOutput ? " is-active" : ""}`}
              onClick={() => setShowWorkingOutput((v) => !v)}
              aria-pressed={showWorkingOutput}
              aria-label={
                showWorkingOutput
                  ? "Hide tool working output"
                  : "Show tool working output"
              }
              data-tooltip={
                showWorkingOutput
                  ? "Hide tool / working output"
                  : "Show tool / working output"
              }
            >
              <IconWorkLog />
            </button>
            <button
              type="button"
              className="btn btn-icon"
              onClick={closeAgentPanel}
              data-tooltip="Close"
              aria-label="Close resume agent chat"
            >
              <IconClose />
            </button>
          </div>
        </div>

        <div
          className="agent-chat-messages"
          ref={listRef}
          role="log"
          aria-labelledby={titleId}
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <p className="muted agent-chat-empty">
              {conversationId
                ? "Ask the agent to edit your selected LaTeX resume using public data and tools. Select text in the PDF and use Add to chat for context."
                : "Choose an agent role and name to start chatting."}
            </p>
          ) : null}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`agent-chat-bubble agent-chat-bubble-${m.role}`}
            >
              {showWorkingOutput && m.tools?.length ? (
                <ul className="agent-chat-tools">
                  {m.tools.map((t, i) => (
                    <li key={`${m.id}-t-${i}`}>{t}</li>
                  ))}
                </ul>
              ) : null}
              {m.text ? <div className="agent-chat-text">{m.text}</div> : null}
            </div>
          ))}
        </div>

        {error ? <div className="error-banner agent-chat-error">{error}</div> : null}

        {contextChips.length > 0 ? (
          <div className="agent-context-chips" aria-label="PDF context for next message">
            {contextChips.map((chip) => (
              <div key={chip.id} className="agent-context-chip">
                <span className="agent-context-chip-label">
                  PDF{chip.page ? ` p.${chip.page}` : ""}: {chipSnippet(chip.text)}
                </span>
                <button
                  type="button"
                  className="agent-context-chip-dismiss"
                  onClick={() => dismissChip(chip.id)}
                  data-tooltip="Remove context"
                  aria-label="Remove PDF context"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <form className="agent-chat-form" onSubmit={onSend}>
          <label className="visually-hidden" htmlFor={`${titleId}-input`}>
            Message
          </label>
          <textarea
            id={`${titleId}-input`}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Edit the summary to emphasize APIs…"
            disabled={busy || !conversationId}
            aria-label="Message"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend(e);
              }
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !conversationId || !input.trim()}
            data-tooltip={busy ? "Working…" : "Send message"}
          >
            {busy ? "Working…" : "Send"}
          </button>
        </form>
      </DraggablePanel>

      {byokOpen ? (
        <Modal
          title="Connect an LLM"
          onClose={onSkipByok}
          footer={
            <>
              <button
                type="button"
                className="btn"
                onClick={onSkipByok}
                data-tooltip="Skip — agent stays closed"
              >
                Skip
              </button>
              <button
                type="submit"
                form={`${titleId}-byok`}
                className="btn btn-primary"
                data-tooltip="Save and open agent"
              >
                Save & continue
              </button>
            </>
          }
        >
          <form id={`${titleId}-byok`} className="stack" onSubmit={onSaveByok}>
            {byokError ? <div className="error-banner">{byokError}</div> : null}
            <p className="muted">
              Keys stay in this browser only. Use a CORS-friendly provider —
              native OpenAI/Anthropic browser calls are not supported.
            </p>
            <label className="field">
              <span>Provider</span>
              <select
                value={byokForm.provider}
                onChange={(e) => {
                  const next =
                    CORS_FRIENDLY_PROVIDERS.find((p) => p.id === e.target.value) ||
                    CORS_FRIENDLY_PROVIDERS[0];
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
            </label>
            <p className="muted">{selectedProvider.hint}</p>
            {selectedProvider.needsBaseUrl ? (
              <label className="field">
                <span>Base URL</span>
                <input
                  type="url"
                  value={byokForm.baseUrl}
                  onChange={(e) =>
                    setByokForm((prev) => ({ ...prev, baseUrl: e.target.value }))
                  }
                  placeholder="https://your-proxy.example/v1"
                  required
                  autoComplete="off"
                />
              </label>
            ) : null}
            <label className="field">
              <span>API key</span>
              <input
                type="password"
                value={byokForm.apiKey}
                onChange={(e) =>
                  setByokForm((prev) => ({ ...prev, apiKey: e.target.value }))
                }
                required
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>Model</span>
              <input
                type="text"
                value={byokForm.model}
                onChange={(e) =>
                  setByokForm((prev) => ({ ...prev, model: e.target.value }))
                }
                required
                spellCheck={false}
              />
            </label>
          </form>
        </Modal>
      ) : null}

      {setupOpen ? (
        <Modal
          title="Initialize agent"
          onClose={() => {
            if (!setupBusy) setSetupOpen(false);
          }}
          footer={
            <>
              <button
                type="button"
                className="btn"
                onClick={() => setSetupOpen(false)}
                disabled={setupBusy}
                data-tooltip="Cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                form={`${titleId}-setup`}
                className="btn btn-primary"
                disabled={setupBusy || !selectedRole || (agents.length > 0 && !selectedName)}
                data-tooltip="Start agent chat"
              >
                {setupBusy ? "Starting…" : "Start"}
              </button>
            </>
          }
        >
          <form id={`${titleId}-setup`} className="stack" onSubmit={onConfirmSetup}>
            {setupError ? <div className="error-banner">{setupError}</div> : null}
            <label className="field">
              <span>Role</span>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                disabled={setupBusy || roles.length === 0}
                required
              >
                {roles.length === 0 ? (
                  <option value="">No roles found</option>
                ) : (
                  roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="field">
              <span>Agent name</span>
              <select
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
                disabled={setupBusy || agents.length === 0}
                required={agents.length > 0}
              >
                {agents.length === 0 ? (
                  <option value="">Default (role baseline)</option>
                ) : (
                  agents.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <p className="muted">
              Chat activates BASE.md + role baseline + persona into one system prompt.
            </p>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
