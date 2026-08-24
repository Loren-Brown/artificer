/**
 * Shared tool registry for in-app agent and W3C WebMCP.
 */

function textResult(payload) {
  return typeof payload === "string"
    ? payload
    : JSON.stringify(payload, null, 2);
}

/**
 * @param {{ resume: object, prompts: object }} ctx
 */
export function createResumeToolDefs(ctx) {
  const { resume, prompts } = ctx;

  return [
    {
      name: "list_public_types",
      description:
        "List resume data types available (private `_` fields are stripped on reads).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      async execute() {
        return textResult(resume.listPublicTypes());
      },
    },
    {
      name: "get_public_document",
      description: "Get a public (stripped) JSON document by type.",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string" },
        },
        required: ["type"],
      },
      async execute({ type }) {
        return textResult(await resume.getPublicDocument(type));
      },
    },
    {
      name: "get_public_item",
      description: "Get one public array item by type and index.",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string" },
          index: { type: "integer" },
        },
        required: ["type", "index"],
      },
      async execute({ type, index }) {
        return textResult(await resume.getPublicItem(type, index));
      },
    },
    {
      name: "get_resume_status",
      description: "Selected resume name and compiled PDF fingerprint info.",
      inputSchema: { type: "object", properties: {} },
      async execute() {
        return textResult(await resume.getPublicResumeStatus());
      },
    },
    {
      name: "get_resume_latex",
      description: "Raw selected .tex source.",
      inputSchema: { type: "object", properties: {} },
      async execute() {
        return textResult(await resume.getPublicResumeText());
      },
    },
    {
      name: "get_resume_pdf",
      description:
        "Compiled PDF as base64 (large). Prefer latex + status unless PDF bytes are required.",
      inputSchema: { type: "object", properties: {} },
      async execute() {
        const bytes = await resume.getPublicResumePdfBytes();
        let binary = "";
        for (let i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i]);
        }
        return textResult({
          mime: "application/pdf",
          base64: btoa(binary),
        });
      },
    },
    {
      name: "list_resume_history",
      description: "Undo/redo metadata for the selected resume.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
      },
      async execute({ name } = {}) {
        return textResult(await resume.getResumeHistory(name));
      },
    },
    {
      name: "undo_resume",
      description: "Undo last resume edit and recompile.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
      },
      async execute({ name } = {}) {
        try {
          return textResult(await resume.undoResume(name));
        } catch (err) {
          if (err.status === 422 && err.body) return textResult(err.body);
          throw err;
        }
      },
    },
    {
      name: "redo_resume",
      description: "Redo resume edit and recompile.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
      },
      async execute({ name } = {}) {
        try {
          return textResult(await resume.redoResume(name));
        } catch (err) {
          if (err.status === 422 && err.body) return textResult(err.body);
          throw err;
        }
      },
    },
    {
      name: "update_resume",
      description:
        "Replace selected LaTeX (filename must match current). Recompiles PDF. On failure returns logTail.",
      inputSchema: {
        type: "object",
        properties: {
          filename: { type: "string" },
          content: { type: "string" },
        },
        required: ["filename", "content"],
      },
      async execute({ filename, content }) {
        try {
          return textResult(
            await resume.updateSelectedResume(content, filename),
          );
        } catch (err) {
          if (err.status === 422 && err.body) return textResult(err.body);
          throw err;
        }
      },
    },
    {
      name: "list_examples",
      description: "Basenames under resume-examples/.",
      inputSchema: { type: "object", properties: {} },
      async execute() {
        return textResult(await resume.listExamples());
      },
    },
    {
      name: "get_example",
      description: "Fetch one example resume by name.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
      async execute({ name }) {
        return textResult(await resume.getExample(name));
      },
    },
    {
      name: "list_agent_roles",
      description:
        "List prompt roles (editors, reviewers, …). Before editing, call get_system_prompt for the chosen persona.",
      inputSchema: { type: "object", properties: {} },
      async execute() {
        return textResult({ roles: await prompts.listRoles() });
      },
    },
    {
      name: "list_agents",
      description: "List agent personas for a role.",
      inputSchema: {
        type: "object",
        properties: { role: { type: "string" } },
        required: ["role"],
      },
      async execute({ role }) {
        return textResult({
          role,
          agents: await prompts.listAgents(role),
        });
      },
    },
    {
      name: "get_system_prompt",
      description:
        "Return the composed system prompt (BASE.md + role baseline + persona AGENT.md). Identical to the in-app agent prompt. Call this before resume edits and follow those instructions.",
      inputSchema: {
        type: "object",
        properties: {
          role: { type: "string" },
          name: { type: "string" },
        },
        required: ["role", "name"],
      },
      async execute({ role, name }) {
        const composed = await prompts.composeAgentMarkdown({ role, name });
        return composed.content;
      },
    },
    {
      name: "activate_agent",
      description:
        "Compose and save the active agent prompt under app/AGENT.md for this workspace.",
      inputSchema: {
        type: "object",
        properties: {
          role: { type: "string" },
          name: { type: "string" },
        },
        required: ["role"],
      },
      async execute({ role, name }) {
        return textResult(await prompts.activateAgent({ role, name }));
      },
    },
  ];
}

export function toolsForAnyLlm(defs) {
  return defs.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

export async function executeToolByName(defs, name, args) {
  const tool = defs.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.execute(args || {});
}

const WEBMCP_FORMS_ROOT_ID = "resume-webmcp-tools";

/** @type {HTMLElement | null} */
let webmcpFormsRoot = null;

function toolActionHref(name) {
  return `#webmcp/${encodeURIComponent(name)}`;
}

/**
 * Build form controls from a JSON Schema object (flat string/number props).
 * @param {object} inputSchema
 */
export function fieldsFromInputSchema(inputSchema) {
  const props = inputSchema?.properties || {};
  const required = new Set(inputSchema?.required || []);
  return Object.entries(props).map(([key, schema]) => {
    const type = schema?.type;
    let control = "text";
    if (type === "integer" || type === "number") control = "number";
    else if (key === "content" || type === "string") {
      control = key === "content" ? "textarea" : "text";
    }
    return {
      name: key,
      control,
      required: required.has(key),
      description:
        typeof schema?.description === "string" && schema.description
          ? schema.description
          : key,
    };
  });
}

function coerceFormArgs(form, inputSchema) {
  const fd = new FormData(form);
  const props = inputSchema?.properties || {};
  const args = {};
  for (const [key, raw] of fd.entries()) {
    const schema = props[key];
    if (schema?.type === "integer") {
      const n = Number.parseInt(String(raw), 10);
      args[key] = Number.isNaN(n) ? raw : n;
    } else if (schema?.type === "number") {
      const n = Number(raw);
      args[key] = Number.isNaN(n) ? raw : n;
    } else {
      args[key] = raw;
    }
  }
  return args;
}

function ensureWebMcpFormsRoot(doc) {
  let root = doc.getElementById(WEBMCP_FORMS_ROOT_ID);
  if (!root) {
    root = doc.createElement("div");
    root.id = WEBMCP_FORMS_ROOT_ID;
    root.setAttribute("data-webmcp-tools", "true");
    // Keep in accessibility tree for agents; hide from sighted layout.
    root.style.cssText =
      "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;";
    doc.body.appendChild(root);
  }
  webmcpFormsRoot = root;
  return root;
}

/**
 * Mount declarative WebMCP forms (`toolname`, `tooldescription`, `toolaction`).
 * Submit runs the same `execute` as the imperative tools (respondWith when agent-invoked).
 */
export function mountDeclarativeWebMcpForms(defs, doc = globalThis.document) {
  if (!doc?.body) {
    return { mounted: false, reason: "Document body not available" };
  }
  unmountDeclarativeWebMcpForms(doc);
  const root = ensureWebMcpFormsRoot(doc);
  const mounted = [];

  for (const tool of defs) {
    const action = toolActionHref(tool.name);
    const form = doc.createElement("form");
    form.setAttribute("toolname", tool.name);
    form.setAttribute("tooldescription", tool.description || tool.name);
    form.setAttribute("toolaction", action);
    form.setAttribute("action", action);
    form.setAttribute("toolautosubmit", "");
    form.setAttribute("data-tool-name", tool.name);
    form.method = "post";

    for (const field of fieldsFromInputSchema(tool.inputSchema)) {
      const label = doc.createElement("label");
      label.textContent = field.description;
      const id = `webmcp-${tool.name}-${field.name}`;
      label.htmlFor = id;

      let input;
      if (field.control === "textarea") {
        input = doc.createElement("textarea");
      } else {
        input = doc.createElement("input");
        input.type = field.control;
      }
      input.id = id;
      input.name = field.name;
      if (field.required) input.required = true;
      input.setAttribute("toolparamdescription", field.description);

      form.appendChild(label);
      form.appendChild(input);
    }

    const submit = doc.createElement("button");
    submit.type = "submit";
    submit.textContent = tool.name;
    form.appendChild(submit);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const args = coerceFormArgs(form, tool.inputSchema);
      const run = () => Promise.resolve(tool.execute(args || {}));
      if (event.agentInvoked && typeof event.respondWith === "function") {
        event.respondWith(run());
        return;
      }
      void run().catch((err) => {
        console.warn(`WebMCP form tool ${tool.name} failed`, err);
      });
    });

    root.appendChild(form);
    mounted.push(tool.name);
  }

  return { mounted: true, tools: mounted };
}

export function unmountDeclarativeWebMcpForms(doc = globalThis.document) {
  const root =
    webmcpFormsRoot || doc?.getElementById?.(WEBMCP_FORMS_ROOT_ID) || null;
  if (root?.parentNode) root.parentNode.removeChild(root);
  webmcpFormsRoot = null;
}

/**
 * Register tools for WebMCP: declarative HTML forms + imperative modelContext when available.
 */
export async function registerToolsOnWebMcp(defs) {
  const declarative = mountDeclarativeWebMcpForms(defs);
  const ctx =
    globalThis.document?.modelContext ||
    globalThis.navigator?.modelContext ||
    null;

  const imperative = [];
  if (ctx?.registerTool) {
    for (const tool of defs) {
      try {
        await ctx.registerTool({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          execute: async (input) => {
            const args =
              typeof input === "string"
                ? JSON.parse(input || "{}")
                : input || {};
            return tool.execute(args);
          },
        });
        imperative.push(tool.name);
      } catch (err) {
        console.warn(`WebMCP registerTool(${tool.name}) failed`, err);
      }
    }
  }

  if (!declarative.mounted && imperative.length === 0) {
    return {
      registered: false,
      reason: declarative.reason || "WebMCP API not available",
    };
  }

  return {
    registered: true,
    tools: defs.map((d) => d.name),
    declarative: declarative.mounted ? declarative.tools : [],
    imperative,
  };
}

export async function unregisterToolsOnWebMcp(defs) {
  unmountDeclarativeWebMcpForms();
  const ctx =
    globalThis.document?.modelContext ||
    globalThis.navigator?.modelContext ||
    null;
  if (!ctx?.unregisterTool) return;
  for (const tool of defs) {
    try {
      await ctx.unregisterTool(tool.name);
    } catch {
      /* ignore */
    }
  }
}
