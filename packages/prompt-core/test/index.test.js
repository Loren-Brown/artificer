import { describe, expect, it } from "vitest";
import {
  roleBaselineFileName,
  assertValidAgentName,
  displayLabel,
  createPromptCore,
} from "../src/index.js";
import { createMemoryRoot } from "../../filesystem-core/test/memfs.js";
import {
  ensureWorkspaceLayout,
  writeTextFile,
} from "../../filesystem-core/src/index.js";

describe("prompt helpers", () => {
  it("maps role folders to baseline filenames", () => {
    expect(roleBaselineFileName("editors")).toBe("EDITOR.md");
    expect(roleBaselineFileName("reviewers")).toBe("REVIEWER.md");
    expect(roleBaselineFileName("rollplay")).toBe("ROLLPLAY.md");
    expect(roleBaselineFileName("")).toBeNull();
  });

  it("validates agent names", () => {
    expect(assertValidAgentName("Greg")).toBe("Greg");
    expect(() => assertValidAgentName("BASE")).toThrow(/Reserved/);
    expect(() => assertValidAgentName("")).toThrow(/Invalid/);
    expect(() => assertValidAgentName("bad/name")).toThrow(/Invalid/);
  });

  it("displayLabel trims", () => {
    expect(displayLabel("  Ada  ")).toBe("Ada");
  });
});

describe("createPromptCore", () => {
  async function seedPrompts(root) {
    await ensureWorkspaceLayout(root);
    await writeTextFile(root, ["prompts", "BASE.md"], "BASE RULES\n");
    await writeTextFile(
      root,
      ["prompts", "editors", "EDITOR.md"],
      "EDITOR ROLE\n",
    );
    await writeTextFile(
      root,
      ["prompts", "editors", "Greg", "AGENT.md"],
      "GREG PERSONA\n",
    );
  }

  it("lists roles and agents, composes and activates", async () => {
    const root = createMemoryRoot();
    await seedPrompts(root);
    const prompts = createPromptCore({ root });

    expect(await prompts.listRoles()).toEqual(["editors"]);
    expect(await prompts.listAgents("editors")).toEqual(["Greg"]);

    const composed = await prompts.composeAgentMarkdown({
      role: "editors",
      name: "greg",
    });
    expect(composed.name).toBe("Greg");
    expect(composed.content).toContain("BASE RULES");
    expect(composed.content).toContain("EDITOR ROLE");
    expect(composed.content).toContain("GREG PERSONA");
    expect(composed.content).toContain("---");

    const activated = await prompts.activateAgent({
      role: "editors",
      name: "Greg",
    });
    expect(activated.bytes).toBeGreaterThan(0);
  });

  it("creates, updates, and deletes agents", async () => {
    const root = createMemoryRoot();
    await seedPrompts(root);
    const prompts = createPromptCore({ root });

    await prompts.createAgent({
      role: "editors",
      name: "Ada",
      content: "ADA BODY\n",
    });
    expect(await prompts.listAgents("editors")).toEqual(["Ada", "Greg"]);

    await prompts.updateAgent("editors", "Ada", "ADA UPDATED\n");
    const read = await prompts.readAgent("editors", "Ada");
    expect(read.content).toContain("ADA UPDATED");

    await prompts.deleteAgent("editors", "Ada");
    expect(await prompts.listAgents("editors")).toEqual(["Greg"]);
  });
});
