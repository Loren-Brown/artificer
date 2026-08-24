# `@resume/resume-core`

In-browser resume domain API: structured JSON data, selected LaTeX, SwiftLaTeX PDF compile, undo history, and a small event bus for the UI.

## What it does

Given a workspace root handle, `createResumeCore({ root })` returns an object that:

- CRUD-validates **resume JSON** under `resume-data/` against schemas fetched from `/schemas/*.schema.json`
- Manages **`.tex` files** under `resumes/`, with selection pointer `app/.current`
- **Compiles** the selected resume to PDF via SwiftLaTeX and stores output under `app/compiled/`
- Tracks **undo/redo** snapshots under `app/history/<stem>/`
- Exposes **public** (privacy-stripped) reads for agents and tools
- Emits `resume:updated` / `pdf:ready` on an in-process **bus** (replaces old SSE webhooks)

## How it works

### Construction

```js
const resume = await createResumeCore({ root });
```

Internally it builds:

- `createDataStore({ root })` — JSON documents + Ajv validation
- `createResumeHistory({ root })` — versioned `.tex` snapshots
- Shared helpers from `@resume/filesystem-core` for all I/O

### JSON data store (`dataStore.js`)

Types:

| Kind | Types | File |
|---|---|---|
| Singleton | `general`, `skills` | `resume-data/<type>.json` |
| Array | `experience`, `education`, `projects`, `certifications` | `resume-data/<type>.json` (JSON array) |

On create/update, empty strings are stripped, the payload is validated with Ajv (schemas loaded from the SPA’s `/schemas/`), then written with light formatting (`format.js`). Array ops support create / update / delete / reorder. Skills categories have dedicated helpers.

### Selection, compile, status

- `app/.current` holds the active `.tex` basename.
- `selectResume(name)` writes `.current`, compiles, emits bus events.
- `compileCurrent()` / `compileSelectedResume()` read `resumes/<name>.tex`, call `compileLatexWithSwiftLatex`, write `app/compiled/<name>.pdf` and optionally `app/logs/<name>.swiftlatex.log`.
- Compile failures return `{ compiled: false, error, logTail }` (or throw `422` with that body from select/update/undo paths).

### SwiftLaTeX (`compile.js`)

1. Lazily load `/swiftlatex/PdfTeXEngine.js` and call `loadEngine()` (worker + WASM).
2. Point the TeX Live on-demand endpoint at `https://texlive.texlyre.org/` (packages + `swiftlatexpdftex.fmt`).
3. Queue compiles so only one runs at a time: `flushCache` → write memfs → set main file → `compileLaTeX()`.
4. Return `{ pdf: Uint8Array, log }` or throw with `err.log` attached.

Assets live under `app/public/swiftlatex/`. Without them, compile fails with a clear setup error.

### History (`resumeHistory.js`)

Per resume stem under `app/history/<stem>/`:

- `index.json` — `{ entries: ["v0001.tex", …], cursor }`
- Version files capped at 50; redo branch is discarded on new push
- `undo` / `redo` move the cursor and return file content for the core to write back to `resumes/` and recompile

### Privacy (`stripPrivate.js`)

`getPublicDocument` / `getPublicItem` recursively drop keys starting with `_` so agents never see private notes.

### Events (`events.js`)

Simple `bus.on` / `bus.emit`. The editor’s API layer maps these to the same “webhook” subscription helpers the UI used when backends were HTTP.

## Layout on disk

```text
resume-data/*.json
resumes/*.tex
resume-examples/*
app/.current
app/compiled/*.pdf
app/logs/*.swiftlatex.log
app/history/<stem>/index.json
app/history/<stem>/vNNNN.tex
```

## Schemas

JSON Schema sources for this package live in `packages/resume-core/schemas/`. The SPA also serves them from `app/public/schemas/` for runtime Ajv loads.
