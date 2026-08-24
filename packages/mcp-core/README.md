# `@resume/mcp-core`

Shared **tool registry** for the in-app agent and optional **W3C WebMCP** registration. Tools call into `resume-core` and `prompt-core`; they never talk HTTP.

## What it does

- `createResumeToolDefs({ resume, prompts })` — build the list of tool objects (name, description, JSON Schema, `execute`)
- `toolsForAnyLlm(defs)` — map defs to OpenAI-style `{ type: "function", function: { … } }` for chat completions
- `executeToolByName(defs, name, args)` — dispatch a tool call
- `registerToolsOnWebMcp(defs)` / `unregisterToolsOnWebMcp(defs)` — declarative HTML forms (`toolname` / `tooldescription` / `toolaction`) plus imperative `modelContext` when available
- `mountDeclarativeWebMcpForms` / `unmountDeclarativeWebMcpForms` / `fieldsFromInputSchema` — declarative form helpers

## How it works

### Tool definition shape

Each tool is:

```js
{
  name: "get_resume_latex",
  description: "…",
  inputSchema: { type: "object", properties: { … }, required: […] },
  async execute(args) { return stringOrJsonString; }
}
```

`execute` always returns a **string** (or JSON stringified payload) so LLM tool messages stay text.

### Tool catalog

| Tool | Backend |
|---|---|
| `list_public_types` | `resume.listPublicTypes()` |
| `get_public_document` / `get_public_item` | Public ( `_`-stripped) JSON |
| `get_resume_status` / `get_resume_latex` / `get_resume_pdf` | Selected resume + compiled PDF |
| `list_resume_history` / `undo_resume` / `redo_resume` | History + recompile |
| `update_resume` | Replace selected `.tex` (must match current name) |
| `list_examples` / `get_example` | `resume-examples/` |
| `list_agent_roles` / `list_agents` / `get_system_prompt` / `activate_agent` | `prompt-core` |

Compile failures on mutating tools surface as returned JSON bodies (`compiled: false`, `logTail`) when the core throws `422` with `err.body`.

### WebMCP

Registration does two things:

1. **Declarative HTML forms** (always when `document.body` exists) under `#resume-webmcp-tools`, each with:
   - `toolname` — tool id
   - `tooldescription` — natural-language purpose
   - `toolaction` / `action` — `#webmcp/<name>` (SPA hash target; submit is handled in JS)
   - `toolautosubmit` — agents may submit without a human click
   - inputs from `inputSchema` with `toolparamdescription`
2. **Imperative** `document.modelContext.registerTool` / `navigator.modelContext` when the browser exposes it

Form submit runs the same `execute` as BYOK tools. Agent-invoked submits use `SubmitEvent.respondWith` when available.

Helpers: `mountDeclarativeWebMcpForms`, `unmountDeclarativeWebMcpForms`, `fieldsFromInputSchema`.

### Wiring

`WorkspaceContext` creates `resume` + `prompts`, then:

```js
const toolDefs = createResumeToolDefs({ resume, prompts });
await registerToolsOnWebMcp(toolDefs);
```

`agent-core`’s `runAgentChat` receives those `toolDefs` and runs the tool loop.

## Privacy note

Public document tools intentionally omit keys starting with `_`. Agents should use those tools for facts, not invent employment history.
