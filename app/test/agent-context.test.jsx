import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentChat } from "../src/components/AgentChat.jsx";
import {
  addPdfSelectionContext,
  buildMessageWithContext,
  PDF_CONTEXT_MAX_CHARS,
} from "../src/agentContext.js";
import * as agentApi from "../src/agentApi.js";
import * as promptApi from "../src/promptApi.js";
import { clearByokConfig, saveByokConfig } from "@resume/agent-core";

describe("agentContext helpers", () => {
  it("builds a message with PDF context blocks", () => {
    const msg = buildMessageWithContext("Please tighten this bullet", [
      { id: "1", text: "Led platform migration", source: "pdf" },
    ]);
    expect(msg).toContain("Context from PDF selection:");
    expect(msg).toContain("Led platform migration");
    expect(msg).toContain("Please tighten this bullet");
  });

  it("truncates long selections", () => {
    const long = "x".repeat(PDF_CONTEXT_MAX_CHARS + 50);
    const chip = addPdfSelectionContext({ text: long });
    expect(chip.text).toHaveLength(PDF_CONTEXT_MAX_CHARS);
  });
});

describe("AgentChat PDF context chips", () => {
  beforeEach(() => {
    clearByokConfig();
    saveByokConfig({
      provider: "openrouter",
      apiKey: "test-key",
      model: "openai/gpt-4o-mini",
    });
    vi.spyOn(agentApi, "streamChat").mockResolvedValue({
      conversationId: "c1",
    });
    vi.spyOn(agentApi, "createConversation").mockResolvedValue({
      conversationId: "c1",
      agentId: "a1",
      role: "editors",
      name: "Greg",
    });
    vi.spyOn(agentApi, "deleteConversation").mockResolvedValue(undefined);
    vi.spyOn(promptApi, "listRoles").mockResolvedValue(["editors", "reviewers"]);
    vi.spyOn(promptApi, "listAgents").mockImplementation(async (role) =>
      role === "editors" ? ["Greg"] : [],
    );
    vi.spyOn(promptApi, "activateAgent").mockResolvedValue({
      role: "editors",
      name: "Greg",
      content: "system",
    });
  });

  afterEach(() => {
    clearByokConfig();
    vi.restoreAllMocks();
  });

  async function startDefaultAgent(user) {
    await user.click(
      screen.getByRole("button", { name: /open resume agent chat/i }),
    );
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /initialize agent/i })).toBeInTheDocument();
    });
    const dialog = screen.getByRole("dialog", { name: /initialize agent/i });
    await waitFor(() => {
      expect(within(dialog).getByRole("combobox", { name: /role/i })).toHaveValue(
        "editors",
      );
    });
    await waitFor(() => {
      expect(within(dialog).getByRole("combobox", { name: /agent name/i })).toHaveValue(
        "Greg",
      );
    });
    await user.click(within(dialog).getByRole("button", { name: /^start$/i }));
    await waitFor(() => {
      expect(promptApi.activateAgent).toHaveBeenCalledWith({
        role: "editors",
        name: "Greg",
      });
      expect(agentApi.createConversation).toHaveBeenCalledWith({
        role: "editors",
        name: "Greg",
      });
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /initialize agent/i }),
      ).not.toBeInTheDocument();
    });
  }

  it("shows init form then wraps PDF context on send", async () => {
    const user = userEvent.setup();
    render(<AgentChat />);

    addPdfSelectionContext({ text: "Improved latency by 40%", source: "pdf" });

    await startDefaultAgent(user);

    await waitFor(() => {
      expect(screen.getByLabelText(/pdf context for next message/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Improved latency by 40%/i)).toBeInTheDocument();
    expect(screen.getByText(/editors \/ Greg/i)).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/edit the summary/i),
      "Rewrite this more clearly",
    );
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => {
      expect(agentApi.streamChat).toHaveBeenCalled();
    });
    const payload = agentApi.streamChat.mock.calls[0][0];
    expect(payload.conversationId).toBe("c1");
    expect(payload.message).toContain("Context from PDF selection:");
    expect(payload.message).toContain("Improved latency by 40%");
    expect(payload.message).toContain("Rewrite this more clearly");

    await waitFor(() => {
      expect(
        screen.queryByLabelText(/pdf context for next message/i),
      ).not.toBeInTheDocument();
    });
  });
});
