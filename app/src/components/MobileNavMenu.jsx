import { useEffect, useId, useRef, useState } from "react";
import { DATA_TYPE_TABS } from "./DataTypeTabList.jsx";

function IconMenu() {
  return (
    <svg
      className="btn-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M4 7.25A.75.75 0 0 1 4.75 6.5h14.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 7.25Zm0 4.75a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 12Zm0 4.75a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 1-.75-.75Z"
      />
    </svg>
  );
}

/**
 * Mobile header menu: section tabs + Settings (replaces tab strip and gear button).
 */
export function MobileNavMenu({ activeId, onChange, onOpenSettings }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectTab(id) {
    onChange(id);
    setOpen(false);
  }

  function openSettings() {
    setOpen(false);
    onOpenSettings?.();
  }

  return (
    <div className="mobile-nav" ref={rootRef}>
      <button
        type="button"
        className="btn btn-icon app-header-action mobile-nav-toggle"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        aria-label={open ? "Close menu" : "Open menu"}
        data-tooltip="Menu"
        onClick={() => setOpen((v) => !v)}
      >
        <IconMenu />
      </button>
      {open ? (
        <div
          id={menuId}
          className="mobile-nav-dropdown"
          role="menu"
          aria-label="App sections"
        >
          {DATA_TYPE_TABS.map((tab) => {
            const selected = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`mobile-nav-item${selected ? " is-active" : ""}`}
                onClick={() => selectTab(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
          <div className="mobile-nav-separator" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="mobile-nav-item mobile-nav-item-settings"
            onClick={openSettings}
          >
            Settings
          </button>
        </div>
      ) : null}
    </div>
  );
}
