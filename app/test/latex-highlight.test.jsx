import { describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { LatexHighlight } from "../src/components/LatexHighlight.jsx";

function shadowPre(container) {
  return container.querySelector(".resume-latex-host")?.shadowRoot?.querySelector(
    "pre.language-latex",
  );
}

describe("LatexHighlight", () => {
  it("renders highlighted LaTeX inside an isolated shadow root", async () => {
    const { container } = render(
      <LatexHighlight code={"\\documentclass{article}\n% comment\nHello"} />,
    );
    const host = container.querySelector(".resume-latex-host");
    expect(host).toBeTruthy();
    expect(host.getAttribute("data-theme")).toBe("light");

    await waitFor(() => {
      expect(shadowPre(container)?.querySelector(".token")).toBeTruthy();
    });
    const pre = shadowPre(container);
    expect(pre.textContent).toContain("documentclass");
    expect(pre.textContent).toContain("comment");
  });

  it("applies the selected Prism theme", async () => {
    const { container } = render(
      <LatexHighlight code={"\\section{Hi}"} theme="dark" />,
    );
    expect(
      container.querySelector(".resume-latex-host")?.getAttribute("data-theme"),
    ).toBe("dark");
    await waitFor(() => {
      expect(shadowPre(container)).toBeTruthy();
    });
  });
});
