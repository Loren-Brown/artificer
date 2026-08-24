# Prompts layout

This directory is the **seed template** copied into the workspace `prompts/` folder when that directory is empty.

## Hierarchy

```text
BASE.md                  Shared tools + safety rules
AGENT.md                 Generated on activate (not seeded)
README.md
editors/
  EDITOR.md              Role baseline
  Greg/
    AGENT.md             Persona-only prompt (CRUD edits this)
reviewers/
  REVIEWER.md
  Default/
    AGENT.md
rollplay/
  ROLLPLAY.md
  Default/
    AGENT.md
```

## Activate

Compose `BASE.md` + `{role}/{ROLE}.md` + `{role}/{name}/AGENT.md`.

## CRUD (editor Agent tab)

Edits **only** each persona’s `AGENT.md`.  
`BASE.md` and role baselines are not exposed through CRUD.
