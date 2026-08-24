import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentTab } from "../src/tabs/AgentTab.jsx";
import * as promptApi from "../src/promptApi.js";

describe("AgentTab", () => {
  beforeEach(() => {
    localStorage.removeItem("resume-agent-selected");
    vi.spyOn(promptApi, "listAllAgents").mockResolvedValue([
      { role: "editors", name: "Greg", label: "Greg" },
      { role: "reviewers", name: "Default", label: "Default" },
    ]);
    vi.spyOn(promptApi, "getAgent").mockImplementation(async (role, name) => ({
      role,
      name,
      label: name,
      content: `# ${name}\n\nPrompt for ${role}\n`,
    }));
    vi.spyOn(promptApi, "saveAgent").mockImplementation(
      async (role, name, content) => ({
        role,
        name,
        label: name,
        content,
      }),
    );
    vi.spyOn(promptApi, "createAgent").mockResolvedValue({
      role: "editors",
      name: "Sam",
      label: "Sam",
      content: "# Sam\n",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem("resume-agent-selected");
  });

  it("loads an agent by display name and saves edits", async () => {
    const user = userEvent.setup();
    render(<AgentTab />);

    await waitFor(() => {
      expect(screen.getByLabelText(/selected agent/i)).toBeInTheDocument();
    });
    await user.selectOptions(
      screen.getByLabelText(/selected agent/i),
      "editors::Greg",
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/selected agent/i)).toHaveValue(
        "editors::Greg",
      );
    });
    await waitFor(() => {
      expect(screen.getByLabelText(/agent prompt markdown/i).value).toContain(
        "Prompt for editors",
      );
    });

    const editor = screen.getByLabelText(/agent prompt markdown/i);
    await user.clear(editor);
    await user.type(editor, "# Greg\n\nUpdated prompt");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(promptApi.saveAgent).toHaveBeenCalledWith(
        "editors",
        "Greg",
        expect.stringContaining("Updated prompt"),
      );
    });
  });

  it("creates a new agent from the + dialog", async () => {
    const user = userEvent.setup();
    promptApi.listAllAgents
      .mockResolvedValueOnce([
        { role: "editors", name: "Greg", label: "Greg" },
      ])
      .mockResolvedValueOnce([
        { role: "editors", name: "Greg", label: "Greg" },
        { role: "editors", name: "Sam", label: "Sam" },
      ]);

    render(<AgentTab />);
    await waitFor(() => {
      expect(screen.getByLabelText(/selected agent/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /more actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /new agent/i }));
    const dialog = screen.getByRole("dialog", { name: /new agent/i });
    await user.type(within(dialog).getByLabelText(/agent name/i), "Sam");
    await user.click(within(dialog).getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(promptApi.createAgent).toHaveBeenCalledWith({
        role: "editors",
        name: "Sam",
      });
    });
    await waitFor(() => {
      expect(screen.getByLabelText(/selected agent/i)).toHaveValue(
        "editors::Sam",
      );
    });
  });
});
