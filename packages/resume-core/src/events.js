/** Simple in-app pub/sub (replaces SSE webhooks). */

const listeners = new Map();

export const bus = {
  on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => listeners.get(event)?.delete(handler);
  },
  emit(event, payload) {
    for (const handler of listeners.get(event) || []) {
      try {
        handler(payload);
      } catch {
        /* ignore */
      }
    }
  },
};
