import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  CORS_FRIENDLY_PROVIDERS,
  loadByokConfig,
  saveByokConfig,
  clearByokConfig,
  isByokConfigured,
  runAgentChat,
} from "../src/index.js";

describe("agent-core BYOK", () => {
  beforeEach(() => {
    clearByokConfig();
  });

  afterEach(() => {
    clearByokConfig();
  });

  it("lists CORS-friendly providers", () => {
    expect(CORS_FRIENDLY_PROVIDERS.map((p) => p.id)).toEqual([
      "openrouter",
      "gemini",
      "openai-compatible",
    ]);
  });

  it("persists and clears config in localStorage", () => {
    expect(isByokConfigured()).toBe(false);
    saveByokConfig({
      provider: "openrouter",
      apiKey: "sk-test",
      model: "openai/gpt-4o-mini",
    });
    expect(isByokConfigured()).toBe(true);
    expect(loadByokConfig()).toMatchObject({
      provider: "openrouter",
      apiKey: "sk-test",
    });
    clearByokConfig();
    expect(loadByokConfig()).toBeNull();
  });
});

describe("runAgentChat", () => {
  beforeEach(() => {
    clearByokConfig();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearByokConfig();
  });

  async function collect(gen) {
    const events = [];
    for await (const ev of gen) events.push(ev);
    return events;
  }

  it("errors when BYOK is not configured", async () => {
    const events = await collect(
      runAgentChat({
        messages: [{ role: "user", content: "hi" }],
        systemPrompt: "sys",
        toolDefs: [],
      }),
    );
    expect(events[0]).toMatchObject({
      event: "error",
      data: { message: expect.stringMatching(/not configured/i) },
    });
    expect(events.at(-1).event).toBe("done");
  });

  it("yields text and completes without tools", async () => {
    saveByokConfig({
      provider: "openrouter",
      apiKey: "sk-test",
      model: "openai/gpt-4o-mini",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        async text() {
          return JSON.stringify({
            choices: [
              { message: { role: "assistant", content: "Hello there" } },
            ],
          });
        },
      })),
    );

    const events = await collect(
      runAgentChat({
        messages: [{ role: "user", content: "hi" }],
        systemPrompt: "sys",
        toolDefs: [],
      }),
    );

    expect(events).toEqual([
      { event: "text", data: { text: "Hello there" } },
      { event: "done", data: {} },
    ]);
  });

  it("runs a tool call then finishes", async () => {
    saveByokConfig({
      provider: "openrouter",
      apiKey: "sk-test",
      model: "openai/gpt-4o-mini",
    });

    const toolDefs = [
      {
        name: "ping",
        description: "ping",
        inputSchema: { type: "object", properties: {} },
        async execute() {
          return "pong";
        },
      },
    ];

    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return {
            ok: true,
            async text() {
              return JSON.stringify({
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: "",
                      tool_calls: [
                        {
                          id: "call_1",
                          type: "function",
                          function: { name: "ping", arguments: "{}" },
                        },
                      ],
                    },
                  },
                ],
              });
            },
          };
        }
        return {
          ok: true,
          async text() {
            return JSON.stringify({
              choices: [
                { message: { role: "assistant", content: "done via tool" } },
              ],
            });
          },
        };
      }),
    );

    const events = await collect(
      runAgentChat({
        messages: [{ role: "user", content: "ping please" }],
        systemPrompt: "sys",
        toolDefs,
      }),
    );

    expect(events.map((e) => e.event)).toEqual([
      "tool",
      "tool",
      "text",
      "done",
    ]);
    expect(events[0].data).toEqual({ name: "ping", status: "running" });
    expect(events[1].data).toEqual({ name: "ping", status: "ok" });
    expect(events[2].data.text).toBe("done via tool");
  });
});
