import { describe, expect, it } from "vitest";
import {
  isLitePath,
  liteHref,
  supportsWorkspaceFilesystem,
} from "../src/browserSupport.js";

describe("browserSupport", () => {
  it("detects /lite paths", () => {
    expect(isLitePath("/lite")).toBe(true);
    expect(isLitePath("/lite/")).toBe(true);
    expect(isLitePath("/lite/extra")).toBe(true);
    expect(isLitePath("/")).toBe(false);
    expect(isLitePath("/resume")).toBe(false);
  });

  it("builds lite href from Vite base /", () => {
    expect(liteHref()).toBe("/lite");
  });

  it("reports directory picker support from window", () => {
    const original = window.showDirectoryPicker;
    try {
      delete window.showDirectoryPicker;
      expect(supportsWorkspaceFilesystem()).toBe(false);
      window.showDirectoryPicker = async () => ({});
      expect(supportsWorkspaceFilesystem()).toBe(true);
    } finally {
      if (original === undefined) delete window.showDirectoryPicker;
      else window.showDirectoryPicker = original;
    }
  });
});
