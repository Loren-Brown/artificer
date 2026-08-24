/**
 * In-process agent chat (BYOK + workspace tools).
 */

import { runAgentChat } from "@resume/agent-core";
import { getPromptApi, getToolDefs } from "./clientRuntime.js";

const conversations = new Map();

function id() {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createConversation({ role = null, name = null } = {}) {
  const prompts = getPromptApi();
  let systemPrompt = "";
  let meta = { role: role || null, name: name || null };
  if (role) {
    const activated = await prompts.activateAgent({ role, name });
    systemPrompt = activated.content;
    meta = { role: activated.role, name: activated.name };
  } else {
    try {
      systemPrompt = (await prompts.readActiveAgent()).content;
      meta = await prompts.getActiveAgentMeta();
    } catch {
      throw new Error("Activate an agent with role/name before chatting");
    }
  }
  const conversationId = id();
  conversations.set(conversationId, {
    systemPrompt,
    messages: [],
    ...meta,
  });
  return {
    conversationId,
    agentId: conversationId,
    role: meta.role,
    name: meta.name,
  };
}

export async function deleteConversation(conversationId) {
  conversations.delete(conversationId);
}

/**
 * Stream chat events via onEvent(eventName, data). Returns { conversationId }.
 */
export async function streamChat({ conversationId, message, signal, onEvent }) {
  const session = conversations.get(conversationId);
  if (!session) {
    throw new Error("Unknown conversation");
  }
  session.messages.push({ role: "user", content: String(message ?? "") });
  onEvent?.("status", { conversationId });

  let assistantText = "";
  for await (const evt of runAgentChat({
    messages: session.messages,
    systemPrompt: session.systemPrompt,
    toolDefs: getToolDefs(),
    signal,
  })) {
    if (evt.event === "text" && evt.data?.text) {
      assistantText += evt.data.text;
    }
    onEvent?.(evt.event, evt.data || {});
  }

  if (assistantText) {
    session.messages.push({ role: "assistant", content: assistantText });
  }
  return { conversationId };
}
