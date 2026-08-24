import { useEffect, useMemo, useRef } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-latex";
import { LATEX_THEMES } from "./latexThemes.js";

export { LATEX_THEMES };
/** Arcane Font tokens — kept inside the shadow tree (host CSS vars do not pierce). */
const ARTIFICER_THEME_CSS = `
code[class*="language-"],
pre[class*="language-"] {
  color: #f4f6f9;
  background: none;
  text-shadow: none;
  font-family: "Fira Code", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 0.84rem;
  line-height: 1.55;
  letter-spacing: 0.01em;
  tab-size: 2;
  hyphens: none;
}
pre[class*="language-"] {
  background: #1c2541;
}
:not(pre) > code[class*="language-"] {
  background: #0b132b;
  padding: 0.1em 0.3em;
  border-radius: 0.3em;
}
.token.comment,
.token.prolog,
.token.doctype,
.token.cdata {
  color: #8da9c4;
  font-style: italic;
}
.token.punctuation {
  color: #8da9c4;
}
.token.namespace {
  opacity: 0.85;
}
.token.property,
.token.tag,
.token.boolean,
.token.number,
.token.constant,
.token.symbol,
.token.deleted {
  color: #e6c07b;
}
.token.selector,
.token.attr-name,
.token.string,
.token.char,
.token.builtin,
.token.inserted {
  color: #00f5d4;
}
.token.operator,
.token.entity,
.token.url,
.language-css .token.string,
.style .token.string {
  color: #8da9c4;
}
.token.atrule,
.token.attr-value,
.token.keyword {
  color: #00b4d8;
}
.token.function,
.token.class-name {
  color: #00b4d8;
}
.token.regex,
.token.important,
.token.variable {
  color: #e6c07b;
}
.token.important,
.token.bold {
  font-weight: 600;
}
.token.italic {
  font-style: italic;
}
.token.entity {
  cursor: help;
}
`;

const PARCHMENT_THEME_CSS = `
code[class*="language-"],
pre[class*="language-"] {
  color: #1c2541;
  background: none;
  text-shadow: none;
  font-family: "Fira Code", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 0.84rem;
  line-height: 1.55;
  letter-spacing: 0.01em;
  tab-size: 2;
  hyphens: none;
}
pre[class*="language-"] {
  background: #f4f6f9;
}
:not(pre) > code[class*="language-"] {
  background: #e8ecf4;
  padding: 0.1em 0.3em;
  border-radius: 0.3em;
}
.token.comment,
.token.prolog,
.token.doctype,
.token.cdata {
  color: #5a7394;
  font-style: italic;
}
.token.punctuation {
  color: #5a7394;
}
.token.property,
.token.tag,
.token.boolean,
.token.number,
.token.constant,
.token.symbol,
.token.deleted {
  color: #9a6b2f;
}
.token.selector,
.token.attr-name,
.token.string,
.token.char,
.token.builtin,
.token.inserted {
  color: #0a8a7a;
}
.token.operator,
.token.entity,
.token.url {
  color: #5a7394;
}
.token.atrule,
.token.attr-value,
.token.keyword,
.token.function,
.token.class-name {
  color: #007a96;
}
.token.regex,
.token.important,
.token.variable {
  color: #9a6b2f;
}
.token.important,
.token.bold {
  font-weight: 600;
}
.token.italic {
  font-style: italic;
}
`;

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
  padding: 1rem 1.15rem;
  border-radius: inherit;
  white-space: pre-wrap;
  word-break: break-word;
  border: none;
  box-shadow: none;
}
code {
  font-family: inherit;
  font-size: inherit;
}
/* Soft mana wash on the Artificer pane */
pre[data-surface="artificer"] {
  background:
    radial-gradient(ellipse 55% 40% at 0% 0%, rgba(0, 180, 216, 0.12) 0%, transparent 55%),
    #1c2541;
}
`;

/**
 * Read-only LaTeX with Prism highlighting in a shadow root so app CSS
 * cannot override theme colors.
 */
export function LatexHighlight({
  code,
  theme = "dark",
  className = "resume-latex-host",
}) {
  const hostRef = useRef(null);
  const html = useMemo(() => {
    if (!code) return "";
    return Prism.highlight(code, Prism.languages.latex, "latex");
  }, [code]);

  const themeId = theme === "light" ? "light" : "dark";

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const shadow =
      host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const themeCss =
      themeId === "dark" ? ARTIFICER_THEME_CSS : PARCHMENT_THEME_CSS;
    const surface = themeId === "dark" ? "artificer" : "parchment";

    shadow.innerHTML = `
      <style>${themeCss}</style>
      <style>${LAYOUT_CSS}</style>
      <pre class="language-latex" data-surface="${surface}" aria-label="Current LaTeX resume"><code class="language-latex">${html}</code></pre>
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
