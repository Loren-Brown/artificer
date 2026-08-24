# Resume App

Static SPA for editing resume data and LaTeX locally in the browser.

Setup, develop, test, lint, and build: [../SETUP.md](../SETUP.md).

## Features

- **Local workspace** via File System Access (`resume-data/`, `resumes/`, `prompts/`, `app/`, …)
- **Tabbed editing** for resume, agent prompts, general, experience, projects, skills, certifications, education
- **Agent tab** edits layered prompt markdown (`BASE` + role + persona)
- **Resume preview** LaTeX + PDF (SwiftLaTeX); HTML/LaTeXML removed
- **Floating agent chat** with BYOK (OpenAI-compatible chat completions) and in-process tools (also registered on WebMCP when available)
- **Create / edit modals**, drag-and-drop reorder, date timelines, a11y checks
