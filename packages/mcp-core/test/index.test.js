import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createResumeToolDefs,
  toolsForAnyLlm,
  executeToolByName,
  fieldsFromInputSchema,
  mountDeclarativeWebMcpForms,
  unmountDeclarativeWebMcpForms,
  registerToolsOnWebMcp,
  unregisterToolsOnWebMcp,
} from "../src/index.js";

function mockResume() {
  return {
    listPublicTypes: () => ({ types: ["general"] }),
    getPublicDocument: async (type) => ({ type, name: "Ada" }),
    getPublicItem: async (type, index) => ({ index, item: { type } }),
    getPublicResumeStatus: async () => ({ current: "a.tex", pdf: "a.pdf" }),
    getPublicResumeText: async () => "\\documentclass{article}",
    getPublicResumePdfBytes: async () => new Uint8Array([1, 2, 3]),
    getResumeHistory: async () => ({ canUndo: false, canRedo: false }),
    undoResume: async () => ({ compiled: true }),
    redoResume: async () => ({ compiled: true }),
    updateSelectedResume: async () => ({ compiled: true }),
    listExamples: async () => ({ items: ["example.tex"] }),
    getExample: async (name) => ({ name, content: "tex" }),
  };
}

function mockPrompts() {
  return {
    listRoles: async () => ["editors"],
    listAgents: async () => ["Greg"],
    composeAgentMarkdown: async () => ({
      role: "editors",
      name: "Greg",
      content: "PROMPT",
    }),
    activateAgent: async () => ({
      role: "editors",
      name: "Greg",
      content: "PROMPT",
    }),
  };
}

/** Minimal document stub with body for declarative forms. */
function installDocument({ withModelContext = false } = {}) {
  const elementsById = new Map();
  const body = {
    children: [],
    appendChild(el) {
      this.children.push(el);
      el.parentNode = this;
      if (el.id) elementsById.set(el.id, el);
    },
    removeChild(el) {
      this.children = this.children.filter((c) => c !== el);
      el.parentNode = null;
      if (el.id) elementsById.delete(el.id);
    },
  };
  const doc = {
    body,
    createElement(tag) {
      const el = {
        tagName: tag.toUpperCase(),
        attrs: {},
        children: [],
        style: { cssText: "" },
        parentNode: null,
        setAttribute(name, value) {
          this.attrs[name] = String(value);
        },
        getAttribute(name) {
          return this.attrs[name] ?? null;
        },
        appendChild(child) {
          this.children.push(child);
          child.parentNode = this;
          if (child.id) elementsById.set(child.id, child);
        },
        addEventListener(type, handler) {
          this.listeners = this.listeners || {};
          this.listeners[type] = handler;
        },
        removeChild(child) {
          this.children = this.children.filter((c) => c !== child);
          child.parentNode = null;
          if (child.id) elementsById.delete(child.id);
        },
      };
      Object.defineProperty(el, "id", {
        get() {
          return this._id || "";
        },
        set(v) {
          if (this._id) elementsById.delete(this._id);
          this._id = v;
          if (v) elementsById.set(v, this);
        },
      });
      return el;
    },
    getElementById(id) {
      return elementsById.get(id) || null;
    },
  };
  if (withModelContext) {
    doc.modelContext = {
      registerTool: vi.fn(async () => {}),
      unregisterTool: vi.fn(async () => {}),
    };
  }
  globalThis.document = doc;
  return doc;
}

describe("mcp-core", () => {
  beforeEach(() => {
    delete globalThis.document;
    delete globalThis.navigator;
    unmountDeclarativeWebMcpForms({ getElementById: () => null });
  });

  afterEach(() => {
    delete globalThis.document;
    delete globalThis.navigator;
  });

  it("builds tool defs and maps them for OpenAI-style APIs", () => {
    const defs = createResumeToolDefs({
      resume: mockResume(),
      prompts: mockPrompts(),
    });
    expect(defs.some((t) => t.name === "get_resume_latex")).toBe(true);
    expect(defs.some((t) => t.name === "get_system_prompt")).toBe(true);

    const mapped = toolsForAnyLlm(defs);
    expect(mapped[0]).toMatchObject({
      type: "function",
      function: { name: defs[0].name },
    });
    expect(mapped[0].function.parameters).toEqual(defs[0].inputSchema);
  });

  it("executes tools by name", async () => {
    const defs = createResumeToolDefs({
      resume: mockResume(),
      prompts: mockPrompts(),
    });
    const latex = await executeToolByName(defs, "get_resume_latex", {});
    expect(latex).toContain("documentclass");

    const doc = await executeToolByName(defs, "get_public_document", {
      type: "general",
    });
    expect(JSON.parse(doc)).toEqual({ type: "general", name: "Ada" });
  });

  it("maps inputSchema properties to form fields", () => {
    const fields = fieldsFromInputSchema({
      type: "object",
      properties: {
        type: { type: "string", description: "Document type" },
        index: { type: "integer" },
        content: { type: "string" },
      },
      required: ["type", "content"],
    });
    expect(fields).toEqual([
      {
        name: "type",
        control: "text",
        required: true,
        description: "Document type",
      },
      {
        name: "index",
        control: "number",
        required: false,
        description: "index",
      },
      {
        name: "content",
        control: "textarea",
        required: true,
        description: "content",
      },
    ]);
  });

  it("mounts declarative forms with toolname, tooldescription, toolaction", () => {
    const doc = installDocument();
    const defs = createResumeToolDefs({
      resume: mockResume(),
      prompts: mockPrompts(),
    }).slice(0, 2);

    const result = mountDeclarativeWebMcpForms(defs, doc);
    expect(result.mounted).toBe(true);
    expect(result.tools).toEqual(defs.map((d) => d.name));

    const root = doc.getElementById("resume-webmcp-tools");
    expect(root).toBeTruthy();
    expect(root.children).toHaveLength(2);

    const form = root.children[0];
    expect(form.getAttribute("toolname")).toBe(defs[0].name);
    expect(form.getAttribute("tooldescription")).toBe(defs[0].description);
    expect(form.getAttribute("toolaction")).toBe(`#webmcp/${defs[0].name}`);
    expect(form.getAttribute("action")).toBe(`#webmcp/${defs[0].name}`);
    expect(form.getAttribute("toolautosubmit")).toBe("");

    unmountDeclarativeWebMcpForms(doc);
    expect(doc.getElementById("resume-webmcp-tools")).toBeNull();
  });

  it("registers declarative forms and imperative modelContext when available", async () => {
    const doc = installDocument({ withModelContext: true });
    const defs = createResumeToolDefs({
      resume: mockResume(),
      prompts: mockPrompts(),
    }).slice(0, 2);

    const result = await registerToolsOnWebMcp(defs);
    expect(result.registered).toBe(true);
    expect(result.tools).toEqual(defs.map((d) => d.name));
    expect(result.declarative).toEqual(defs.map((d) => d.name));
    expect(result.imperative).toEqual(defs.map((d) => d.name));
    expect(doc.modelContext.registerTool).toHaveBeenCalledTimes(2);

    await unregisterToolsOnWebMcp(defs);
    expect(doc.modelContext.unregisterTool).toHaveBeenCalledTimes(2);
    expect(doc.getElementById("resume-webmcp-tools")).toBeNull();
  });

  it("registers via declarative forms when modelContext is missing", async () => {
    installDocument({ withModelContext: false });
    const defs = createResumeToolDefs({
      resume: mockResume(),
      prompts: mockPrompts(),
    }).slice(0, 1);
    const result = await registerToolsOnWebMcp(defs);
    expect(result.registered).toBe(true);
    expect(result.declarative).toEqual([defs[0].name]);
    expect(result.imperative).toEqual([]);
  });

  it("reports when document body is unavailable", async () => {
    delete globalThis.document;
    delete globalThis.navigator;
    const defs = createResumeToolDefs({
      resume: mockResume(),
      prompts: mockPrompts(),
    });
    const result = await registerToolsOnWebMcp(defs);
    expect(result).toEqual({
      registered: false,
      reason: "Document body not available",
    });
  });

  it("throws on unknown tool names", async () => {
    await expect(executeToolByName([], "nope", {})).rejects.toThrow(
      /Unknown tool/,
    );
  });
});
