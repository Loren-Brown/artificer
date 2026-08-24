# `@resume/agent-core`

In-browser **BYOK** agent runtime: OpenAI-compatible `/chat/completions` from the page, with a bounded tool-calling loop over `@resume/mcp-core`.

## What it does

- Persist and load **bring-your-own-key** provider config in `localStorage`
- List **CORS-friendly** providers (OpenRouter, Gemini’s OpenAI-compatible endpoint, custom base URL)
- Run **`runAgentChat`**: async generator that yields UI events (`text`, `tool`, `error`, `done`) while the model may call resume/prompt tools

It does not own workspace I/O or prompt files. System prompt text and tool defs are passed in by the editor.

## How it works

### BYOK config

Stored under key `resume-builder-byok`:

```json
{ "provider": "openrouter", "apiKey": "…", "model": "…", "baseUrl": "optional" }
```

Helpers: `loadByokConfig`, `saveByokConfig`, `clearByokConfig`, `isByokConfigured`.

`CORS_FRIENDLY_PROVIDERS` supplies labels, default models, and default base URLs. Providers must allow browser `fetch` with `Authorization: Bearer …` (no Node SDK — those do not bundle cleanly in Vite).

### Chat completions

`chatCompletion` POSTs to `{baseUrl}/chat/completions` with:

- `stream: false` (the UI streams by consuming the async generator’s tool/text events, not SSE from the vendor)
- `tools` + `tool_choice: "auto"` when tool defs are present
- Messages normalized to OpenAI shape (`tool_call_id`, `tool_calls`, etc.)

Non-OK responses parse vendor error JSON when possible and throw a readable `Error`.

### Tool loop (`runAgentChat`)

```js
for await (const ev of runAgentChat({
  messages,       // user/assistant turns (no system)
  systemPrompt,   // composed BASE + role + persona
  toolDefs,       // from createResumeToolDefs
  signal,         // AbortSignal from the chat UI
})) {
  // ev.event: "text" | "tool" | "error" | "done"
}
```

Algorithm:

1. Require BYOK config; otherwise yield `error` + `done`.
2. Build `conversation = [system, …messages]`.
3. Up to **8** rounds: call the model; yield any assistant `text`; if there are `tool_calls`, for each one yield `tool` running/ok/error, `executeToolByName`, append a `role: "tool"` message, then call the model again.
4. Stop when there are no tool calls, on abort, or after the guard limit.
5. Always end with `done` (unless mid-abort path already did).

The chat UI (`AgentChat`) consumes these events to render tokens and tool status without depending on Cursor SDK or a backend agent service.

### Security / ops notes

- API keys never leave the browser except to the user-chosen provider.
- Only CORS-enabled endpoints work; classic `api.openai.com` from a random origin will fail unless proxied.
- Tool side effects (e.g. `update_resume`) mutate the local workspace and may trigger SwiftLaTeX compile via `resume-core`.
