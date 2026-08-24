import { useId, useRef } from "react";

/**
 * Accessibility navigation map (tabs pattern):
 * tablist "Resume data types"
 *   ├─ tab (roving tabindex) ──ArrowRight/Left/Home/End──► next/prev/first/last tab
 *   └─ controls ► tabpanel labelled by the selected tab
 */
export const DATA_TYPE_TABS = [
  { id: "resume", label: "Resume" },
  { id: "agent", label: "Agent" },
  { id: "general", label: "General" },
  { id: "experience", label: "Professional Experience" },
  { id: "projects", label: "Projects" },
  { id: "skills", label: "Skills" },
  { id: "certifications", label: "Certifications" },
  { id: "education", label: "Education" },
];

export function DataTypeTabList({ activeId, onChange, idPrefix }) {
  const generatedPrefix = useId();
  const prefix = idPrefix ?? generatedPrefix;
  const tabRefs = useRef({});

  function selectTab(nextId) {
    onChange(nextId);
    queueMicrotask(() => {
      tabRefs.current[nextId]?.focus();
    });
  }

  function onTabKeyDown(event, tabId) {
    const index = DATA_TYPE_TABS.findIndex((tab) => tab.id === tabId);
    if (index < 0) return;

    let nextId = null;
    if (event.key === "ArrowRight") {
      nextId = DATA_TYPE_TABS[(index + 1) % DATA_TYPE_TABS.length].id;
    } else if (event.key === "ArrowLeft") {
      nextId =
        DATA_TYPE_TABS[(index - 1 + DATA_TYPE_TABS.length) % DATA_TYPE_TABS.length]
          .id;
    } else if (event.key === "Home") {
      nextId = DATA_TYPE_TABS[0].id;
    } else if (event.key === "End") {
      nextId = DATA_TYPE_TABS[DATA_TYPE_TABS.length - 1].id;
    }

    if (!nextId) return;
    event.preventDefault();
    selectTab(nextId);
  }

  return (
    <div
      className="tabs"
      role="tablist"
      aria-label="Resume data types"
    >
      {DATA_TYPE_TABS.map((tab) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${prefix}-${tab.id}`}
            ref={(node) => {
              tabRefs.current[tab.id] = node;
            }}
            className={`tab ${selected ? "active" : ""}`}
            aria-selected={selected}
            aria-controls={`${prefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            data-tooltip={tab.label}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => onTabKeyDown(event, tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function dataTypePanelProps(prefix, activeId) {
  return {
    role: "tabpanel",
    id: `${prefix}-panel-${activeId}`,
    "aria-labelledby": `${prefix}-${activeId}`,
  };
}
