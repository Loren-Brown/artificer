/** Mutable runtime bound after workspace open. */

let resume = null;
let prompts = null;
let toolDefs = [];

export function setClientRuntime({ resume: r, prompts: p, toolDefs: t } = {}) {
  resume = r ?? null;
  prompts = p ?? null;
  toolDefs = t ?? [];
}

export function getResumeApi() {
  if (!resume) {
    const err = new Error("Workspace is not open");
    err.status = 503;
    throw err;
  }
  return resume;
}

export function getPromptApi() {
  if (!prompts) {
    const err = new Error("Workspace is not open");
    err.status = 503;
    throw err;
  }
  return prompts;
}

export function getToolDefs() {
  return toolDefs;
}
