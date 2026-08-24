# Resume

Personal resume tooling for modern tech applications.

The **Resume Builder** helps you craft and maintain tech resumes locally in the browser. Your data stays in a workspace folder you choose; no backend is required at runtime.

**Setup, develop, and test:** [SETUP.md](./SETUP.md)  
**Third-party libraries & licenses:** [DEPENDENCIES.md](./DEPENDENCIES.md)

## Features

- Keep your resume, job history, projects, skills, education, and certifications in one private workspace on your computer — nothing is uploaded to a server
- Edit structured resume data in tabs, with forms, reorderable lists, and a career timeline view
- Write and preview LaTeX resumes side by side, and compile a PDF in the browser
- Version resume edits with history, undo, and redo
- Start from example resumes and seed data, then tailor copies for different applications
- Get help from an LLM agent in two ways (see [LLM integration](#llm-integration))
- Customize agent personas (editors, reviewers, and more) with layered prompts you control



## The app runs fully client side. Yes, really!

This is a static web app that runs entirely in your browser. Open it, pick a folder on your machine, and work. There is no application server holding your resumes, no account database, and no “sync to the cloud” step waiting in the wings.

**Your files stay on your machine.** Resume data, LaTeX, prompts, history, and PDFs live in the workspace folder you choose. They are not uploaded to this project’s host. The only network calls the app makes for AI help are the ones *you* choose: to *your* LLM provider when you use bring-your-own-key chat, or through your browser’s own WebMCP agent when you use that path.

Agent help is designed the same way: **bring your own key (BYOK)** in the in-app chat, or **WebMCP** with a browser agent. This project does not proxy model calls through a backend.

That design is intentional:

- **I don't want your data.** Your career history is yours. Keeping it local means it never becomes someone else’s product input.
- **I don't want to pay for your LLM credit usage.** You bring the key (or the browser agent); you control cost and provider.
- **I don't want to pay to host a complex web app that can be run client side.** Static files are enough. No always-on API fleet for a tool that already works in the browser.



## LLM integration

You can use an AI agent to help edit your resume in either of these ways. Both use the same tools (below) so the agent can read public resume facts and update LaTeX — your private notes stay local.

### 1. In-app chat (bring your own key)

Open the floating resume agent in the app, pick a persona (editor, reviewer, …), and chat. You supply an API key for a provider that works from the browser; the key stays in your browser and is only sent to that provider. The agent runs in the page and can revise the selected resume through tools.

### 2. Browser AI via WebMCP

When your browser supports WebMCP, the same capabilities are available to a browser-built-in or extension agent while this app is open. That agent can discover and call the tools below without using the in-app chat panel. Support is still experimental and limited to certain Chromium builds.

### Shared tools


| Tool                  | What it does                                                       |
| --------------------- | ------------------------------------------------------------------ |
| `list_public_types`   | Shows which kinds of resume data are available                     |
| `get_public_document` | Reads a full public resume data document (e.g. experience, skills) |
| `get_public_item`     | Reads one item from a public list (e.g. a single job or project)   |
| `get_resume_status`   | Reports which resume is selected and whether a PDF is ready        |
| `get_resume_latex`    | Reads the current resume’s LaTeX source                            |
| `get_resume_pdf`      | Returns the compiled PDF (use sparingly; large)                    |
| `list_resume_history` | Shows whether undo/redo is available for the current resume        |
| `undo_resume`         | Reverts the last resume change and refreshes the PDF               |
| `redo_resume`         | Re-applies an undone resume change and refreshes the PDF           |
| `update_resume`       | Replaces the current resume’s LaTeX and rebuilds the PDF           |
| `list_examples`       | Lists starter/example resumes                                      |
| `get_example`         | Loads one example resume’s content                                 |
| `list_agent_roles`    | Lists agent roles (e.g. editors, reviewers)                        |
| `list_agents`         | Lists personas available for a role                                |
| `get_system_prompt`   | Returns the full instructions for a chosen persona                 |
| `activate_agent`      | Sets which agent persona is active for the workspace               |


Private fields (names starting with `_`) are never returned by the public read tools.

## Layout


| Path                       | Role                                   |
| -------------------------- | -------------------------------------- |
| `[app/](./app/README.md)`  | Vite/React SPA                         |
| `[packages/](./packages/)` | Shared browser libraries (`@resume/*`) |




## Shared libraries

Under `packages/` (Vite aliases `@resume/*`):


| Package                                                   | Role                             |
| --------------------------------------------------------- | -------------------------------- |
| `[filesystem-core](./packages/filesystem-core/README.md)` | File System Access workspace I/O |
| `[resume-core](./packages/resume-core/README.md)`         | Resume data + SwiftLaTeX compile |
| `[prompt-core](./packages/prompt-core/README.md)`         | Prompt composition               |
| `[mcp-core](./packages/mcp-core/README.md)`               | In-app agent / WebMCP tools      |
| `[agent-core](./packages/agent-core/README.md)`           | BYOK chat + tool loop            |




## TODO

- [ ] Harden BYOK tool interface (role allowlists; later: confirm writes / schema validation)
- [ ] Imporve Example Resume Tools + CRUD
- [ ] Improve UX for mobile
- [ ] Add multi agent support
- [ ] Improve defualt agent personas
- [ ] Add deterministic static resume generator tools
- [ ] Add job application tracking tools (What resume you submitted, timelines, success/failure metrics)
- [ ] Add cover letter generator tools
- [ ] Google Drive integration or iCloud integration
- [ ] Experiment with HTML based resumes instead of latex
- [ ] Experiment with deep github integration where you can fork and host your resume directly in github somehow