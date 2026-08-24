import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentChat } from "../../src/components/AgentChat.jsx";
import { saveByokConfig, clearByokConfig } from "@resume/agent-core";

describe("AgentChat", () => {
  beforeEach(() => {
    clearByokConfig();
    saveByokConfig({
      provider: "openrouter",
      apiKey: "test-key",
      model: "openai/gpt-4o-mini",
    });
  });

  afterEach(() => {
    clearByokConfig();
  });

  it("opens the floating panel from the launcher", async () => {
    const user = userEvent.setup();
    render(<AgentChat />);
    await user.click(screen.getByRole("button", { name: /open resume agent chat/i }));
    expect(screen.getByRole("heading", { name: /resume agent/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/edit the summary/i)).toBeInTheDocument();
  });
});
