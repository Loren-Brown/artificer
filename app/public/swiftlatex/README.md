# SwiftLaTeX engines

PdfTeX browser assets (from [SwiftLaTeX releases](https://github.com/SwiftLaTeX/SwiftLaTeX/releases)):

- `PdfTeXEngine.js` — API wrapper (`ENGINE_PATH` patched to `/swiftlatex/swiftlatexpdftex.js`; `setTexliveEndpoint` no longer drops the worker)
- `swiftlatexpdftex.js` — engine worker (default TeX Live endpoint patched to `https://texlive.texlyre.org/`)
- `swiftlatexpdftex.wasm` — WASM binary

These ship under `public/swiftlatex/` so Vite serves them at `/swiftlatex/*`.

Packages and `swiftlatexpdftex.fmt` are fetched on demand from the TeX Live endpoint (`pdftex/<format>/<name>`). The upstream `texlive2.swiftlatex.com` mirror is often unavailable; we use [TeXlyre’s mirror](https://texlive.texlyre.org/).

To refresh from upstream:

```bash
# download release zip, then copy the three files above into this folder
# and re-apply:
#   ENGINE_PATH = '/swiftlatex/swiftlatexpdftex.js'
#   texlive_endpoint = 'https://texlive.texlyre.org/'
#   setTexliveEndpoint must not set latexWorker = undefined
```
