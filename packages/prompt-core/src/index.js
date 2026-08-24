/**
 * Browser prompt workspace (layered BASE + role + persona).
 */

import {
  getDir,
  listNames,
  pathExists,
  readTextFile,
  writeTextFile,
} from "../../filesystem-core/src/index.js";

export const ACTIVE_AGENT_FILE = "AGENT.md";
export const SHARED_BASE_FILE = "BASE.md";

const AGENT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,63}$/;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function roleBaselineFileName(role) {
  const r = String(role ?? "").trim();
  if (!r) return null;
  const singular =
    r.endsWith("s") && r.toLowerCase() !== "rollplay" ? r.slice(0, -1) : r;
  return `${singular.toUpperCase()}.md`;
}

export function displayLabel(name) {
  return String(name ?? "").trim();
}

export function assertValidAgentName(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed || !AGENT_NAME_RE.test(trimmed)) {
    throw httpError(
      400,
      "Invalid agent name. Use 1–64 chars: letters, numbers, spaces, _ . -",
    );
  }
  const upper = trimmed.toUpperCase();
  if (["BASE", "EDITOR", "REVIEWER", "ROLLPLAY", "AGENT"].includes(upper)) {
    throw httpError(400, `Reserved agent name: ${trimmed}`);
  }
  return trimmed;
}

function joinSections(parts) {
  return `${parts.filter(Boolean).join("\n\n---\n\n")}\n`;
}

function isMissingPathError(err) {
  return (
    err?.name === "NotFoundError" ||
    /could not be found/i.test(err?.message || "") ||
    /not found/i.test(err?.message || "")
  );
}

/**
 * Prompts always live under workspace `prompts/`.
 */
async function resolvePromptsSegments(root) {
  if (!(await pathExists(root, ["prompts"], "dir"))) {
    await getDir(root, ["prompts"], { create: true });
  }
  return ["prompts"];
}

/**
 * @param {{ root: FileSystemDirectoryHandle }} options
 */
export function createPromptCore({ root }) {
  let promptsSegmentsPromise = null;

  function promptsSegments() {
    if (!promptsSegmentsPromise) {
      promptsSegmentsPromise = resolvePromptsSegments(root);
    }
    return promptsSegmentsPromise;
  }

  async function promptsPath(...parts) {
    const base = await promptsSegments();
    return [...base, ...parts];
  }

  async function listRoles() {
    const base = await promptsSegments();
    const names = await listNames(root, base, { dirs: true, files: false });
    // Role folders only — ignore stray dirs if any.
    return names;
  }

  async function listAgents(role) {
    const roles = await listRoles();
    if (!roles.includes(role)) throw httpError(404, `Unknown role: ${role}`);
    const names = await listNames(root, await promptsPath(role), {
      dirs: true,
      files: false,
    });
    return names.sort((a, b) => a.localeCompare(b));
  }

  async function resolveAgentName(role, name) {
    const agents = await listAgents(role);
    const wanted = String(name ?? "").trim();
    if (!wanted) return null;
    if (agents.includes(wanted)) return wanted;
    return agents.find((a) => a.toLowerCase() === wanted.toLowerCase()) ?? null;
  }

  async function readAgent(role, name) {
    const resolved = await resolveAgentName(role, name);
    if (!resolved) throw httpError(404, `Unknown agent: ${role}/${name}`);
    try {
      const content = await readTextFile(
        root,
        await promptsPath(role, resolved, ACTIVE_AGENT_FILE),
      );
      return {
        role,
        name: resolved,
        label: displayLabel(resolved),
        content,
      };
    } catch (err) {
      if (isMissingPathError(err)) {
        throw httpError(
          404,
          `Agent file missing: ${role}/${resolved}/${ACTIVE_AGENT_FILE}`,
        );
      }
      throw err;
    }
  }

  async function composeAgentMarkdown({ role, name = null } = {}) {
    const roleName = String(role ?? "").trim();
    if (!roleName) throw httpError(400, "role is required");
    const agents = await listAgents(roleName);
    let agentName = name == null || name === "" ? null : String(name).trim();
    if (!agentName) {
      if (agents.length === 1) agentName = agents[0];
      else {
        throw httpError(
          400,
          `Agent name is required for role "${roleName}". Choose one of: ${agents.join(", ")}`,
        );
      }
    }
    const resolved = await resolveAgentName(roleName, agentName);
    if (!resolved) {
      throw httpError(404, `Unknown agent "${agentName}" for role "${roleName}"`);
    }

    let base = "";
    let roleBody = "";
    let persona = "";
    try {
      base = (await readTextFile(root, await promptsPath(SHARED_BASE_FILE))).trim();
    } catch (err) {
      if (!isMissingPathError(err)) throw err;
    }
    const baseline = roleBaselineFileName(roleName);
    try {
      roleBody = (
        await readTextFile(root, await promptsPath(roleName, baseline))
      ).trim();
    } catch (err) {
      if (!isMissingPathError(err)) throw err;
    }
    try {
      persona = (
        await readTextFile(
          root,
          await promptsPath(roleName, resolved, ACTIVE_AGENT_FILE),
        )
      ).trim();
    } catch (err) {
      if (isMissingPathError(err)) {
        throw httpError(
          404,
          `Agent file missing: ${roleName}/${resolved}/${ACTIVE_AGENT_FILE}`,
        );
      }
      throw err;
    }

    return {
      role: roleName,
      name: resolved,
      content: joinSections([base, roleBody, persona].filter(Boolean)),
    };
  }

  return {
    listRoles,
    listAgents,
    resolveAgentName,
    async listAllAgents(rolesFilter = null) {
      const roles =
        rolesFilter?.length
          ? (await listRoles()).filter((r) => rolesFilter.includes(r))
          : await listRoles();
      const agents = [];
      for (const role of roles) {
        for (const name of await listAgents(role)) {
          agents.push({ role, name, label: displayLabel(name) });
        }
      }
      return agents.sort(
        (a, b) =>
          a.label.localeCompare(b.label) || a.role.localeCompare(b.role),
      );
    },
    readAgent,
    async createAgent({ role, name, content = null } = {}) {
      const roleName = String(role ?? "").trim();
      const agentName = assertValidAgentName(name);
      if (!(await listRoles()).includes(roleName)) {
        throw httpError(404, `Unknown role: ${roleName}`);
      }
      if (await resolveAgentName(roleName, agentName)) {
        throw httpError(409, `Agent already exists: ${agentName}`);
      }
      const body =
        content != null && String(content).trim()
          ? String(content)
          : `# ${agentName}\n\nPersona notes for this ${roleName} agent.\n`;
      const base = await promptsSegments();
      await getDir(root, [...base, roleName, agentName], { create: true });
      await writeTextFile(
        root,
        await promptsPath(roleName, agentName, ACTIVE_AGENT_FILE),
        body.endsWith("\n") ? body : `${body}\n`,
      );
      return readAgent(roleName, agentName);
    },
    async updateAgent(role, name, content) {
      const existing = await readAgent(role, name);
      if (content == null || !String(content).trim()) {
        throw httpError(400, "content is required and must be non-empty");
      }
      const text = String(content);
      await writeTextFile(
        root,
        await promptsPath(existing.role, existing.name, ACTIVE_AGENT_FILE),
        text.endsWith("\n") ? text : `${text}\n`,
      );
      return readAgent(existing.role, existing.name);
    },
    async deleteAgent(role, name) {
      const existing = await readAgent(role, name);
      const base = await promptsSegments();
      const dir = await getDir(root, [...base, existing.role], {
        create: false,
      });
      await dir.removeEntry(existing.name, { recursive: true });
      return { ok: true, role: existing.role, name: existing.name };
    },
    composeAgentMarkdown,
    async activateAgent({ role, name = null } = {}) {
      const composed = await composeAgentMarkdown({ role, name });
      await writeTextFile(root, ["app", ACTIVE_AGENT_FILE], composed.content);
      await writeTextFile(
        root,
        ["app", "active-agent.json"],
        `${JSON.stringify({ role: composed.role, name: composed.name }, null, 2)}\n`,
      );
      return {
        role: composed.role,
        name: composed.name,
        content: composed.content,
        bytes: new TextEncoder().encode(composed.content).length,
      };
    },
    async readActiveAgent() {
      if (!(await pathExists(root, ["app", ACTIVE_AGENT_FILE], "file"))) {
        throw httpError(
          404,
          "No AGENT.md yet. Activate an agent with role/name first.",
        );
      }
      return {
        content: await readTextFile(root, ["app", ACTIVE_AGENT_FILE]),
      };
    },
    async getActiveAgentMeta() {
      if (!(await pathExists(root, ["app", "active-agent.json"], "file"))) {
        return { role: null, name: null };
      }
      return JSON.parse(await readTextFile(root, ["app", "active-agent.json"]));
    },
  };
}
