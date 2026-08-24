export const CURRENT_PREFIX = "CURRENT_";
export const CURRENT_POINTER = ".current";

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function sanitizeLatexFileName(raw) {
  if (raw == null || typeof raw !== "string") {
    throw httpError(400, "File name is required");
  }
  let name = raw.trim();
  if (name.startsWith(CURRENT_PREFIX)) {
    name = name.slice(CURRENT_PREFIX.length);
  }
  if (!name) throw httpError(400, "File name is required");
  if (
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("\0") ||
    name === "." ||
    name === ".." ||
    name.startsWith(".")
  ) {
    throw httpError(400, "Invalid file name");
  }
  if (!/^[A-Za-z0-9._-]+\.tex$/i.test(name)) {
    throw httpError(
      400,
      "File name must be a .tex basename using letters, numbers, dots, underscores, or hyphens",
    );
  }
  return name;
}

export function sanitizeLatexContent(raw) {
  const text = String(raw ?? "");
  const dangerous = [
    /\\write18\b/i,
    /\\immediate\s*\\write18\b/i,
    /\\input\s*\{\s*\|/,
    /\\openout\b/i,
    /\\openin\b/i,
    /\\readline\b/i,
  ];
  for (const pattern of dangerous) {
    if (pattern.test(text)) {
      throw httpError(400, "LaTeX content contains disallowed commands");
    }
  }
  return text;
}
