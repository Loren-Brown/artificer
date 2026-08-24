/**
 * Recursively remove object keys that start with `_` (private fields).
 * Used by the public read-only API for agent / export consumers.
 */
export function stripPrivateFields(value) {
  if (Array.isArray(value)) {
    return value.map(stripPrivateFields);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key.startsWith("_")) continue;
      out[key] = stripPrivateFields(entry);
    }
    return out;
  }
  return value;
}
