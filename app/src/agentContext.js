/** Max characters stored per PDF selection context chip. */
export const PDF_CONTEXT_MAX_CHARS = 4000;

const contextListeners = new Set();
const openListeners = new Set();
const promptSavedListeners = new Set();
const resumeFullscreenListeners = new Set();

let resumeFullscreen = false;

/**
 * Subscribe to agent context events.
 * Handler receives `{ type: "add", chip }` where chip is `{ id, text, page, source }`.
 * @returns {() => void} unsubscribe
 */
export function subscribeAgentContext(handler) {
  contextListeners.add(handler);
  return () => contextListeners.delete(handler);
}

/**
 * Subscribe to requests to open the agent chat panel.
 * @returns {() => void} unsubscribe
 */
export function subscribeOpenAgentChat(handler) {
  openListeners.add(handler);
  return () => openListeners.delete(handler);
}

export function requestOpenAgentChat() {
  for (const handler of openListeners) {
    try {
      handler();
    } catch {
      /* ignore subscriber errors */
    }
  }
}

/**
 * Whether the resume PDF/LaTeX preview is in fullscreen overlay mode.
 */
export function getResumeFullscreen() {
  return resumeFullscreen;
}

export function setResumeFullscreen(next) {
  const value = Boolean(next);
  if (value === resumeFullscreen) return;
  resumeFullscreen = value;
  for (const handler of resumeFullscreenListeners) {
    try {
      handler(value);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

/**
 * @returns {() => void} unsubscribe
 */
export function subscribeResumeFullscreen(handler) {
  resumeFullscreenListeners.add(handler);
  try {
    handler(resumeFullscreen);
  } catch {
    /* ignore */
  }
  return () => resumeFullscreenListeners.delete(handler);
}

/**
 * Subscribe when an agent persona file is saved from the Agent tab.
 * Handler receives `{ role, name }`.
 * @returns {() => void} unsubscribe
 */
export function subscribeAgentPromptSaved(handler) {
  promptSavedListeners.add(handler);
  return () => promptSavedListeners.delete(handler);
}

export function notifyAgentPromptSaved({ role, name } = {}) {
  const payload = {
    role: String(role ?? "").trim(),
    name: name == null || name === "" ? null : String(name).trim(),
  };
  if (!payload.role) return;
  for (const handler of promptSavedListeners) {
    try {
      handler(payload);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

/**
 * Publish a PDF text selection as context for the agent chat.
 * Opens the chat panel.
 */
export function addPdfSelectionContext({ text, page = null, source = "pdf" } = {}) {
  const trimmed = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PDF_CONTEXT_MAX_CHARS);
  if (!trimmed) return null;

  const chip = {
    id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: trimmed,
    page: page == null ? null : Number(page),
    source: source || "pdf",
  };

  for (const handler of contextListeners) {
    try {
      handler({ type: "add", chip });
    } catch {
      /* ignore subscriber errors */
    }
  }
  requestOpenAgentChat();
  return chip;
}

/** Prepend context chips into the user message sent to the agent. */
export function buildMessageWithContext(userText, chips = []) {
  const body = String(userText ?? "").trim();
  if (!chips.length) return body;
  const blocks = chips.map((c) => c.text).join("\n\n---\n\n");
  return `Context from PDF selection:\n"""\n${blocks}\n"""\n\n${body}`;
}
