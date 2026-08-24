# `@resume/prompt-core`

Layered agent-prompt workspace: shared `BASE.md`, per-role baselines, and per-persona `AGENT.md` files under `prompts/`.

## What it does

`createPromptCore({ root })` manages prompt markdown in the workspace:

- List **roles** (directories under `prompts/`) and **agents** (persona folders)
- **Read / create / update / delete** persona `AGENT.md` files (editor CRUD)
- **Compose** the full system prompt: `BASE.md` + role baseline + persona
- **Activate** an agent by writing the composed prompt to `app/AGENT.md` (and recording selection in `app/active-agent.json` when used by the UI)

It does not call LLMs. Chat runtime is `@resume/agent-core`; tools that expose these APIs are in `@resume/mcp-core`.

## How it works

### Directory layout

```text
prompts/
  BASE.md                 Shared rules (tools, safety)
  README.md
  editors/
    EDITOR.md             Role baseline
    Greg/
      AGENT.md            Persona-only body (CRUD edits this)
  reviewers/
    REVIEWER.md
    Default/
      AGENT.md
  rollplay/
    ROLLPLAY.md
    Default/
      AGENT.md
```

Role baseline filename is derived from the role folder: `editors` → `EDITOR.md`, `reviewers` → `REVIEWER.md`, `rollplay` → `ROLLPLAY.md` (`roleBaselineFileName`).

### Composition

`composeAgentMarkdown({ role, name })`:

1. Resolve persona name (case-insensitive; required if more than one agent exists for the role).
2. Read `prompts/BASE.md` (optional if missing).
3. Read `prompts/<role>/<ROLE>.md` baseline (optional if missing).
4. Read `prompts/<role>/<name>/AGENT.md` (required).
5. Join non-empty parts with `\n\n---\n\n`.

`activateAgent({ role, name })` composes and writes `app/AGENT.md` so the chat panel and any external reader share one “active” prompt snapshot.

### CRUD rules

- Persona names must match `^[A-Za-z0-9][A-Za-z0-9 _.-]{0,63}$` and cannot be reserved (`BASE`, `EDITOR`, `REVIEWER`, `ROLLPLAY`, `AGENT`).
- Create/update/delete only touch `<role>/<name>/AGENT.md`. Baselines and `BASE.md` are not writable through these APIs (edit them as files or via seed).
- Missing `prompts/` is created on first use.

### I/O

All paths go through `@resume/filesystem-core` (`readTextFile`, `writeTextFile`, `listNames`, `getDir`, `pathExists`). Errors for missing files are normalized to HTTP-like `{ status, message }` errors for the editor’s existing UI patterns.

## Seeding

Empty workspaces are filled from `app/public/seed/prompts/` by `filesystem-core`’s seed step. After that, prompts live entirely in the user’s folder.
