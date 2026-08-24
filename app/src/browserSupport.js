/**
 * Whether this browser can use the File System Access directory picker
 * required for full (on-disk) workspace mode.
 */
export function supportsWorkspaceFilesystem() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

/** Lite route under the configured Vite base (always ends without trailing slash except root). */
export function liteHref() {
  const base = import.meta.env.BASE_URL || "/";
  const joined = `${base}lite`.replace(/\/{2,}/g, "/");
  return joined.startsWith("/") ? joined : `/${joined}`;
}

export function isLitePath(pathname = window.location.pathname) {
  const lite = liteHref().replace(/\/+$/, "") || "/lite";
  return (
    pathname === lite ||
    pathname === `${lite}/` ||
    pathname.startsWith(`${lite}/`)
  );
}

const LITE_REDIRECT_FLAG = "artificer-lite-from-unsupported";

export function markLiteRedirect() {
  try {
    sessionStorage.setItem(LITE_REDIRECT_FLAG, "1");
  } catch {
    /* ignore */
  }
}

export function consumeLiteRedirectFlag() {
  try {
    const v = sessionStorage.getItem(LITE_REDIRECT_FLAG);
    if (v) sessionStorage.removeItem(LITE_REDIRECT_FLAG);
    return Boolean(v);
  } catch {
    return false;
  }
}

/** Navigate to lite mode (full page so WorkspaceProvider remounts cleanly). */
export function redirectToLite() {
  markLiteRedirect();
  window.location.replace(liteHref());
}

/**
 * Wipe browser-only Artificer state (localStorage, sessionStorage, workspace
 * handle DB, Cache API) so the next load matches a first visit. Does not delete
 * files on disk in a workspace folder.
 */
export async function clearBrowserAppCache() {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }

  try {
    const { HANDLE_DB } = await import("@resume/filesystem-core");
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(HANDLE_DB);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  } catch {
    /* ignore */
  }

  try {
    if (typeof caches !== "undefined" && caches?.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* ignore */
  }
}
