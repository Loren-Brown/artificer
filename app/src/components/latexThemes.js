export const LATEX_THEMES = Object.freeze([
  { id: "dark", label: "Artificer" },
  { id: "light", label: "Parchment" },
]);

export const LATEX_THEME_STORAGE_KEY = "resume-latex-theme";

const listeners = new Set();

export function loadLatexTheme() {
  try {
    const saved = localStorage.getItem(LATEX_THEME_STORAGE_KEY);
    if (LATEX_THEMES.some((t) => t.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return "dark";
}

export function saveLatexTheme(next) {
  const theme = LATEX_THEMES.some((t) => t.id === next) ? next : "dark";
  try {
    localStorage.setItem(LATEX_THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  for (const handler of listeners) {
    try {
      handler(theme);
    } catch {
      /* ignore */
    }
  }
  return theme;
}

export function subscribeLatexTheme(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}
