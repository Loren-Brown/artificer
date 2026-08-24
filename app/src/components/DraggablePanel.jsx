import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "resume-agent-chat-pos";

function loadPosition() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.x === "number" &&
      typeof parsed?.y === "number"
    ) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Draggable floating panel. Drag via elements with data-drag-handle.
 */
export function DraggablePanel({
  open,
  children,
  className = "",
  initialOffset = { x: 24, y: 24 },
}) {
  const [pos, setPos] = useState(
    () => loadPosition() ?? { x: initialOffset.x, y: initialOffset.y },
  );
  const dragRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {
      // ignore
    }
  }, [pos]);

  const onPointerDown = useCallback((event) => {
    if (event.button !== 0) return;
    const handle = event.target.closest("[data-drag-handle]");
    if (!handle) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...pos };
    dragRef.current = { startX, startY, origin };

    const onMove = (ev) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPos({
        x: Math.max(8, dragRef.current.origin.x + dx),
        y: Math.max(8, dragRef.current.origin.y + dy),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [pos]);

  if (!open) return null;

  return (
    <div
      className={`draggable-panel ${className}`.trim()}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={onPointerDown}
    >
      {children}
    </div>
  );
}
