# Dependencies

Third-party libraries used by this repo, how they are used, and their licenses.

Versions are whatever `npm install` resolves under the declared ranges in `app/package.json` and the root `package.json`. Re-check with `npm ls` / package `license` fields after major upgrades.

This is an inventory for maintainers, not legal advice.

## Summary

| Category | Verdict for free public hosting |
|---|---|
| npm **production** deps (shipped in the SPA) | Permissive — MIT / Apache-2.0 / BSD / 0BSD / dual Apache-or-MIT |
| npm **dev** deps (build / test / lint only) | Permissive; **axe-core** is MPL-2.0 (dev-only) |
| **SwiftLaTeX** (vendored under `app/public/swiftlatex/`) | EPL-2.0 OR GPL-2.0 WITH Classpath-exception — usable publicly if notices and modified sources stay available |
| First-party `packages/*` | Your code (this repo) |

No AGPL, SSPL, or BUSL packages appear in the declared dependency trees.

---

## Production (shipped to users)

Declared in `app/package.json` `dependencies`. These are bundled or served with the SPA.

| Package | License | How it is used |
|---|---|---|
| `react` | MIT | UI components and hooks across `app/src` |
| `react-dom` | MIT | `createRoot` bootstrap in `app/src/main.jsx` |
| `@dnd-kit/core` | MIT | Drag-and-drop sensors/context for reorderable lists (`ItemList.jsx`) |
| `@dnd-kit/sortable` | MIT | Sortable list behavior for resume data items |
| `@dnd-kit/utilities` | MIT | CSS transform helpers for dnd-kit |
| `ajv` | MIT | JSON Schema validation in `packages/resume-core` (`dataStore.js`); resolved via Vite alias to `app/node_modules` |
| `ajv-formats` | MIT | Format validators (dates, etc.) for Ajv schemas |
| `pdfjs-dist` | Apache-2.0 | PDF page rendering / text selection in `PdfViewer.jsx` |
| `prismjs` | MIT | LaTeX syntax highlighting in `LatexHighlight.jsx` |
| `vis-timeline` | Apache-2.0 OR MIT | Career / date timelines in `Timeline.jsx` (`vis-timeline/standalone`) |
| `vis-data` | Apache-2.0 OR MIT | `DataSet` used with vis-timeline |

### Notable production transitive / peer packages

Pulled in with the production graph (especially vis-timeline peers). All permissive in the current install:

| Package | License | Role |
|---|---|---|
| `scheduler` | MIT | React internals |
| `fast-deep-equal`, `json-schema-traverse`, `fast-uri`, `require-from-string` | MIT / BSD-3 | Ajv helpers |
| `tslib` | 0BSD | TypeScript helpers (dnd-kit / others) |
| `@dnd-kit/accessibility` | MIT | a11y helpers for dnd-kit |
| `@egjs/hammerjs`, `propagating-hammerjs`, `component-emitter`, `keycharm`, `moment`, `uuid`, `vis-util`, `xss` | MIT or Apache-2.0 OR MIT | vis-timeline peer stack |

---

## Development (not shipped)

Declared in `app/package.json` and/or root `package.json` `devDependencies`. Used for local build, lint, and tests only.

| Package | License | How it is used |
|---|---|---|
| `vite` | MIT | Dev server, SPA build, preview (`app/`) |
| `@vitejs/plugin-react` | MIT | JSX / React Fast Refresh for Vite |
| `vitest` | MIT | Unit / component / package tests (`app/` + root `test:packages`) |
| `jsdom` | MIT | DOM environment for Vitest (app + `agent-core`) |
| `eslint` | MIT | Lint SPA source (`app/eslint.config.js`) |
| `@eslint/js` | MIT | ESLint recommended JS config |
| `eslint-plugin-react` | MIT | React lint rules |
| `eslint-plugin-react-hooks` | MIT | Hooks lint rules |
| `eslint-plugin-jsx-a11y` | MIT | Accessibility lint rules |
| `globals` | MIT | Browser globals for ESLint |
| `@testing-library/react` | MIT | Component tests |
| `@testing-library/user-event` | MIT | User-event simulation in tests |
| `@testing-library/jest-dom` | MIT | DOM matchers in tests |
| `@types/prismjs` | MIT | Type hints for Prism (editor / tooling) |
| `axe-core` | **MPL-2.0** | Accessibility checks in a11y tests — **do not bundle into the public app** without MPL compliance |

Root `package.json` only lists `vitest` and `jsdom` for running `packages/*/test`.

---

## Vendored / non-npm

| Asset | License | How it is used |
|---|---|---|
| SwiftLaTeX PdfTeX (`PdfTeXEngine.js`, `swiftlatexpdftex.js`, `.wasm`) | **EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0** | In-browser LaTeX → PDF compile (`packages/resume-core` `compile.js`); served from `app/public/swiftlatex/` |
| TeX Live packages / `.fmt` (fetched at runtime from TeXlyre CDN) | Mostly LPPL / TeX distribution licenses | On-demand package fetch by the SwiftLaTeX worker — not vendored in this repo |

### SwiftLaTeX compliance notes

- Keep upstream copyright / SPDX headers in the engine files.
- Local patches (absolute `ENGINE_PATH`, TeX Live endpoint, `setTexliveEndpoint` worker fix) are distributed as source in this repo under the same dual license terms for those files.
- Classpath-exception means choosing the GPL option for the engine does not force the whole SPA under GPL.
- Documenting this dependency (this file) helps attribution.

---

## First-party packages

Not third-party. Listed for completeness; see each README.

| Package | Role |
|---|---|
| `@resume/filesystem-core` | File System Access workspace I/O |
| `@resume/resume-core` | Resume JSON + LaTeX + SwiftLaTeX compile |
| `@resume/prompt-core` | Layered agent prompts |
| `@resume/mcp-core` | Agent / WebMCP tool registry |
| `@resume/agent-core` | BYOK chat + tool loop |

---

## License quick reference (shipped code)

Same shape as a compliance audit of the current tree:

| License | Examples here | Typical effect for a free public web app |
|---|---|---|
| **MIT** | React, dnd-kit, Prism, Vite, most of the stack | Use, modify, redistribute; keep copyright notice |
| **Apache-2.0** | pdfjs-dist; also offered by vis-* | Same, plus patent grant; preserve NOTICE if present |
| **BSD-3-Clause** | `fast-uri` (Ajv) | Permissive; keep notice |
| **0BSD** | `tslib` | Extremely permissive |
| **Apache-2.0 OR MIT** | vis-timeline, vis-data, vis-util, keycharm | Pick either; both fine for public hosting |
| **MPL-2.0** | axe-core (dev only) | File-level weak copyleft — keep as test/lint only |
| **EPL-2.0 OR GPL-2.0 + Classpath** | SwiftLaTeX engines | OK to host; keep notices; share modifications to EPL-covered engine files |

---

## Regenerating this inventory

```bash
# Declared deps
cat app/package.json package.json

# License field from installed packages (example)
node -e "const j=require('./app/node_modules/react/package.json'); console.log(j.name, j.license)"
```

After adding a dependency, update this file and prefer **MIT / Apache-2.0 / BSD / ISC** (or dual licenses that include those) for anything that ships to users.
