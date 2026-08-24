import { useEffect, useMemo, useRef } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-latex";
import prismLight from "prismjs/themes/prism.css?inline";
import prismDark from "prismjs/themes/prism-dark.css?inline";

export const LATEX_THEMES = Object.freeze([
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
]);

const LAYOUT_CSS = `
:host {
  display: block;
  height: 100%;
  min-height: 70vh;
  box-sizing: border-box;
}
pre {
  margin: 0;
  height: 100%;
  min-height: 70vh;
  box-sizing: border-box;
  overflow: auto;
  padding: 1rem 1.1rem;
  border-radius: inherit;
  white-space: pre-wrap;
  word-break: break-word;
}
code {
  font-family: inherit;
  font-size: inherit;
}
`;

/**
 * Read-only LaTeX with Prism highlighting in a shadow root so app CSS
 * cannot override Prism light/dark theme colors.
 */
export function LatexHighlight({
  code,
  theme = "light",
  className = "resume-latex-host",
}) {
  const hostRef = useRef(null);
  const html = useMemo(() => {
    if (!code) return "";
    return Prism.highlight(code, Prism.languages.latex, "latex");
  }, [code]);

  const themeId = theme === "dark" ? "dark" : "light";

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const shadow =
      host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const themeCss = themeId === "dark" ? prismDark : prismLight;

    shadow.innerHTML = `
      <style>${themeCss}</style>
      <style>${LAYOUT_CSS}</style>
      <pre class="language-latex" aria-label="Current LaTeX resume"><code class="language-latex">${html}</code></pre>
    `;
  }, [html, themeId]);

  return (
    <div
      ref={hostRef}
      className={className}
      data-theme={themeId}
    />
  );
}
