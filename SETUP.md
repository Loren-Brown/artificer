# Setup

Local-first static SPA: resume data, prompts, and PDF compile run in the browser against a folder you choose (File System Access API). No Node API is required at runtime.

## Requirements

- Node.js (for install / Vite / tests)
- Chrome or Edge recommended (directory picker)
- Localhost or HTTPS (File System Access + WebMCP)

## App

```bash
npm install --prefix app
npm run app:dev
```

- UI: http://127.0.0.1:5173
- First visit: pick or create a workspace folder (seeded with examples)

From `app/` you can also run `npm run client` (or `npm run dev`).

### Workspace layout

Folders inside the **user-chosen workspace directory** (not the git repo):

```text
resume-data/        JSON documents (general, experience, …)
resumes/            LaTeX sources
resume-examples/    Example resumes
prompts/            Agent prompt layers (BASE + roles + personas)
app/                .current, compiled PDF, logs, history, AGENT.md
```

### PDF (SwiftLaTeX)

Place PdfTeX engine assets under `app/public/swiftlatex/` — see [that folder’s README](./app/public/swiftlatex/README.md). Without them, the LaTeX view still works; PDF compile shows a setup error.

### Agent (BYOK)

Opening the agent requires a CORS-friendly LLM key (OpenRouter, Gemini, or OpenAI-compatible with CORS). Chat uses OpenAI-compatible `/chat/completions` from the browser (`packages/agent-core`). Keys stay in `localStorage`. Skip leaves the agent closed.

### Test / lint / build / preview

```bash
npm run app:test
npm run app:lint
npm run app:build
npm run app:preview
```

From `app/`:

```bash
npm test
npm run lint
npm run build
npm run preview
```

Host `app/dist/` over HTTPS for File System Access + WebMCP in production.

## Tests

From the repo root (after `npm install`):

```bash
npm run test:packages   # Vitest suites under packages/*/test
npm run app:test        # SPA / UI tests
npm test                # both
```

Each package has its own `test/` directory. Shared in-memory File System Access mocks live in `packages/filesystem-core/test/memfs.js`.

Schemas used by the SPA live in `packages/resume-core/schemas/` and are served from `app/public/schemas/`.
