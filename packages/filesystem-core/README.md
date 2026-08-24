# `@resume/filesystem-core`

Browser filesystem layer for the Resume Builder SPA. It wraps the **File System Access API** so the rest of the app can treat a user-chosen folder as a durable workspace.

## What it does

- Lets the user **pick or restore** a local workspace directory
- **Persists** the directory handle in IndexedDB so the next visit can re-prompt for permission instead of re-picking
- Ensures a fixed **workspace layout** (`resume-data/`, `resumes/`, `prompts/`, …)
- Provides path-segment helpers for **read / write / list / delete** of text and binary files
- **Seeds** an empty workspace from static assets under `/seed/`

This package has no knowledge of resumes, prompts, or agents — only folders and files.

## How it works

### Workspace handle lifecycle

1. `pickWorkspaceDirectory()` calls `showDirectoryPicker({ mode: "readwrite" })` (Chrome/Edge, localhost or HTTPS).
2. `saveRootHandle(handle)` stores that `FileSystemDirectoryHandle` in IndexedDB (`resume-builder-workspace` / store `handles` / key `root`).
3. On later loads, `loadRootHandle()` returns the stored handle; `ensurePermission(handle, "readwrite")` re-requests access. Stale handles that throw `NotFoundError` are treated as “no permission” so the UI can clear and re-pick.
4. `clearRootHandle()` removes the stored handle when the user disconnects the workspace.

### Path model

All I/O takes a **root handle** plus an array of path segments (never raw absolute paths):

```js
await readTextFile(root, ["resumes", "example.tex"]);
await writeBinaryFile(root, ["app", "compiled", "example.pdf"], bytes);
```

`getDir(root, segments, { create })` walks or creates nested directories. Invalid segments (`.`, `..`, empty) are rejected. Missing folders / lost write access are turned into clearer `NotFoundError` messages that tell the user to re-pick the workspace.

### Layout and seeding

`WORKSPACE_SUBDIRS` defines the top-level folders. `ensureWorkspaceLayout(root)` creates them plus `app/compiled`, `app/logs`, and `app/history`.

`prepareWorkspace(root)` ensures that layout and, if `prompts/` has no role directories, calls `seedWorkspace`. `seedWorkspace(root, { force })` copies known seed URLs (prompts, example JSON/TeX) into the workspace, skipping files that already exist unless `force` is set. Schemas are not seeded here — they are served by Vite. Copies go through `copyUrlToWorkspace` (`fetch` → `writeBinaryFile`).

### Consumers

`resume-core` and `prompt-core` call these helpers exclusively for disk access. The editor’s `WorkspaceContext` owns the root handle and permission UX.

## Browser requirements

File System Access with writable directory handles. Prefer Chromium-based browsers over `http://127.0.0.1` or HTTPS. Safari/Firefox generally lack this API for arbitrary folders.
