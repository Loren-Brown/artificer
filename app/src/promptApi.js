import { getPromptApi } from "./clientRuntime.js";

export async function listRoles() {
  return getPromptApi().listRoles();
}

export async function listAgents(role) {
  return getPromptApi().listAgents(role);
}

export async function listAllAgents(roles = ["editors", "reviewers"]) {
  return getPromptApi().listAllAgents(roles);
}

export async function getAgent(role, name) {
  return getPromptApi().readAgent(role, name);
}

export async function createAgent({ role, name, content = null } = {}) {
  return getPromptApi().createAgent({ role, name, content });
}

export async function saveAgent(role, name, content) {
  return getPromptApi().updateAgent(role, name, content);
}

export async function deleteAgent(role, name) {
  return getPromptApi().deleteAgent(role, name);
}

export async function activateAgent({ role, name = null } = {}) {
  return getPromptApi().activateAgent({ role, name });
}

export function agentKey(role, name) {
  return `${role}::${name}`;
}

export function parseAgentKey(key) {
  const idx = String(key ?? "").indexOf("::");
  if (idx < 0) return { role: "", name: "" };
  return {
    role: key.slice(0, idx),
    name: key.slice(idx + 2),
  };
}
