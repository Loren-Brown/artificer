import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(rootDir, "..");
const packagesDir = path.join(monorepoRoot, "packages");
const nm = (name) => path.resolve(rootDir, "node_modules", name);

export default defineConfig({
  base: "/artificer/",
  plugins: [react()],
  resolve: {
    alias: {
      "@resume/filesystem-core": path.join(
        packagesDir,
        "filesystem-core/src/index.js",
      ),
      "@resume/resume-core": path.join(packagesDir, "resume-core/src/index.js"),
      "@resume/prompt-core": path.join(packagesDir, "prompt-core/src/index.js"),
      "@resume/mcp-core": path.join(packagesDir, "mcp-core/src/index.js"),
      "@resume/agent-core": path.join(packagesDir, "agent-core/src/index.js"),
      // Libraries live under packages/; pin deps to this app's node_modules.
      ajv: nm("ajv"),
      "ajv-formats": nm("ajv-formats"),
    },
  },
  optimizeDeps: {
    include: ["ajv", "ajv-formats"],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/node_modules/**", "**/dist/**"],
    },
    hmr: true,
  },
  test: {
    environment: "jsdom",
    include: [
      "test/utils.test.js",
      "test/latex-highlight.test.jsx",
      "test/agent-context.test.jsx",
      "test/agent-tab.test.jsx",
      "test/a11y/**/*.{test,spec}.{js,jsx}",
    ],
    setupFiles: ["./test/setup-dom.js"],
  },
});
