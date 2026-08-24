/**
 * In-browser agent runtime with OpenAI-compatible chat completions + tools.
 * (any-llm-ts is Node-oriented and does not bundle cleanly in the browser.)
 */

import {
  executeToolByName,
  toolsForAnyLlm,
} from "../../mcp-core/src/index.js";

const BYOK_KEY = "resume-builder-byok";

export const CORS_FRIENDLY_PROVIDERS = [
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "openai/gpt-4o-mini",
    hint: "Works from the browser; use an OpenRouter API key.",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.0-flash",
    hint: "Uses Google’s OpenAI-compatible endpoint (browser CORS).",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  {
    id: "openai-compatible",
    label: "OpenAI-compatible (CORS-enabled)",
    defaultModel: "gpt-4o-mini",
    hint: "Requires a base URL that allows browser CORS (e.g. a local proxy you control).",
    needsBaseUrl: true,
  },
];

export function loadByokConfig() {
  try {
    const raw = localStorage.getItem(BYOK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.provider || !parsed?.apiKey || !parsed?.model) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveByokConfig(config) {
  localStorage.setItem(BYOK_KEY, JSON.stringify(config));
}

export function clearByokConfig() {
  localStorage.removeItem(BYOK_KEY);
}

export function isByokConfigured() {
  return Boolean(loadByokConfig());
}

function resolveBaseUrl(config) {
  if (config.baseUrl) return String(config.baseUrl).replace(/\/$/, "");
  const provider = CORS_FRIENDLY_PROVIDERS.find((p) => p.id === config.provider);
  if (provider?.defaultBaseUrl) return provider.defaultBaseUrl;
  throw new Error("Missing API base URL");
}

function toOpenAiMessages(messages) {
  return messages.map((m) => {
    const out = { role: m.role, content: m.content };
    if (m.name) out.name = m.name;
    if (m.tool_call_id || m.toolCallId) {
      out.tool_call_id = m.tool_call_id || m.toolCallId;
    }
    if (m.tool_calls || m.toolCalls) {
      out.tool_calls = m.tool_calls || m.toolCalls;
    }
    return out;
  });
}

async function chatCompletion(config, { messages, tools, signal }) {
  const baseUrl = resolveBaseUrl(config);
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model: config.model,
    messages: toOpenAiMessages(messages),
    stream: false,
  };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`LLM response was not JSON (${res.status})`);
  }
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      text.slice(0, 400) ||
      `LLM request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

/**
 * Run a chat turn with tools; yield SSE-shaped events for AgentChat.
 */
export async function* runAgentChat({
  messages,
  systemPrompt,
  toolDefs,
  signal,
}) {
  const config = loadByokConfig();
  if (!config) {
    yield { event: "error", data: { message: "LLM provider is not configured" } };
    yield { event: "done", data: {} };
    return;
  }

  const tools = toolsForAnyLlm(toolDefs);
  const conversation = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  try {
    let guard = 0;
    while (guard < 8) {
      guard += 1;
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      const response = await chatCompletion(config, {
        messages: conversation,
        tools,
        signal,
      });

      const choice = response?.choices?.[0] || {};
      const message = choice.message || {};
      const content = message.content || "";
      const toolCalls = message.tool_calls || [];

      if (content) {
        yield { event: "text", data: { text: content } };
      }

      conversation.push({
        role: "assistant",
        content: content || null,
        tool_calls: toolCalls.length ? toolCalls : undefined,
      });

      if (!toolCalls.length) break;

      for (const call of toolCalls) {
        const name = call.function?.name || call.name;
        const rawArgs = call.function?.arguments || call.arguments || "{}";
        let args = {};
        try {
          args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
        } catch {
          args = {};
        }
        yield { event: "tool", data: { name, status: "running" } };
        let resultText;
        try {
          resultText = await executeToolByName(toolDefs, name, args);
          yield { event: "tool", data: { name, status: "ok" } };
        } catch (err) {
          resultText = err.message || String(err);
          yield { event: "tool", data: { name, status: "error" } };
        }
        conversation.push({
          role: "tool",
          tool_call_id: call.id,
          name,
          content:
            typeof resultText === "string"
              ? resultText
              : JSON.stringify(resultText),
        });
      }
    }

    yield { event: "done", data: {} };
  } catch (err) {
    if (err?.name === "AbortError") {
      yield { event: "done", data: { aborted: true } };
      return;
    }
    yield {
      event: "error",
      data: { message: err.message || String(err) },
    };
    yield { event: "done", data: {} };
  }
}
