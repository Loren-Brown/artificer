import { defineConfig } from "vitest/config";

/** Agent-core needs localStorage from jsdom; other packages use node. */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "packages-node",
          environment: "node",
          include: [
            "packages/filesystem-core/test/**/*.test.js",
            "packages/resume-core/test/**/*.test.js",
            "packages/prompt-core/test/**/*.test.js",
            "packages/mcp-core/test/**/*.test.js",
          ],
        },
      },
      {
        test: {
          name: "packages-dom",
          environment: "jsdom",
          include: ["packages/agent-core/test/**/*.test.js"],
        },
      },
    ],
  },
});
