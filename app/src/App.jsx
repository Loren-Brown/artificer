import { lazy, Suspense, useEffect, useId, useState } from "react";
import {
  CertificationsTab,
  EducationTab,
  ExperienceTab,
  GeneralTab,
  ProjectsTab,
  ResumeTab,
  SkillsTab,
} from "./tabs/Tabs.jsx";
import {
  DATA_TYPE_TABS,
  DataTypeTabList,
  dataTypePanelProps,
} from "./components/DataTypeTabList.jsx";
import { BrandMark } from "./components/BrandMark.jsx";
import { SettingsButton } from "./components/SettingsButton.jsx";
import { MobileNavMenu } from "./components/MobileNavMenu.jsx";
import {
  WorkspaceProvider,
  useWorkspace,
} from "./workspace/WorkspaceContext.jsx";
import { WorkspaceGate } from "./workspace/WorkspaceGate.jsx";
import {
  consumeLiteRedirectFlag,
  isLitePath,
  redirectToLite,
  supportsWorkspaceFilesystem,
} from "./browserSupport.js";

const AgentTab = lazy(() =>
  import("./tabs/AgentTab.jsx").then((m) => ({ default: m.AgentTab })),
);
const AgentChat = lazy(() =>
  import("./components/AgentChat.jsx").then((m) => ({ default: m.AgentChat })),
);

const TAB_COMPONENTS = {
  resume: ResumeTab,
  agent: AgentTab,
  general: GeneralTab,
  experience: ExperienceTab,
  projects: ProjectsTab,
  skills: SkillsTab,
  certifications: CertificationsTab,
  education: EducationTab,
};

const ACTIVE_TAB_STORAGE_KEY = "resume-editor-active-tab";

function readCachedActiveTab() {
  try {
    const saved = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    if (saved && DATA_TYPE_TABS.some((tab) => tab.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return "resume";
}

function AppShell() {
  const { phase, changeWorkspace, root, isLite } = useWorkspace();
  const [active, setActiveState] = useState(readCachedActiveTab);
  const [showLiteBanner, setShowLiteBanner] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const tabPrefix = useId();
  const current =
    DATA_TYPE_TABS.find((tab) => tab.id === active) ?? DATA_TYPE_TABS[0];
  const Active = TAB_COMPONENTS[current.id];
  const workspaceName = root?.name ? String(root.name) : "";

  useEffect(() => {
    if (isLite && consumeLiteRedirectFlag()) {
      setShowLiteBanner(true);
    }
  }, [isLite]);

  function setActive(nextId) {
    setActiveState(nextId);
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, nextId);
    } catch {
      /* ignore */
    }
  }

  if (phase !== "ready") {
    if (isLite) {
      return (
        <div className="workspace-gate">
          <p className="muted">Loading Lite workspace…</p>
        </div>
      );
    }
    return <WorkspaceGate />;
  }

  return (
    <div className="app">
      {showLiteBanner ? (
        <div className="lite-banner" role="status">
          <p>
            This browser can’t use local folders. You’re in Lite mode (in-memory
            seed; changes are lost on refresh).
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => setShowLiteBanner(false)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <header className="app-header">
        <div className="app-brand">
          <BrandMark size={43} />
          <div className="app-brand-text">
            <h1>
              Artificer
              <span className="app-brand-section"> {current.label}</span>
            </h1>
            <p className="app-brand-slogan">
              Enchanted resume builder{isLite ? " · Lite" : ""}
            </p>
          </div>
        </div>
        <div className="app-header-actions">
          <MobileNavMenu
            activeId={active}
            onChange={setActive}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <SettingsButton
            workspaceName={workspaceName}
            onChangeWorkspace={changeWorkspace}
            isLite={isLite}
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
          />
        </div>
      </header>
      <DataTypeTabList
        activeId={active}
        onChange={setActive}
        idPrefix={tabPrefix}
      />
      <div {...dataTypePanelProps(tabPrefix, current.id)}>
        <Suspense fallback={<div className="lazy-pane-fallback">Loading…</div>}>
          <Active />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <AgentChat activeTabId={active} />
      </Suspense>
    </div>
  );
}

function FullAppRedirect() {
  useEffect(() => {
    if (!supportsWorkspaceFilesystem()) {
      redirectToLite();
    }
  }, []);

  if (!supportsWorkspaceFilesystem()) {
    return (
      <div className="workspace-gate">
        <p className="muted">Redirecting to Lite mode…</p>
      </div>
    );
  }

  return (
    <WorkspaceProvider mode="full">
      <AppShell />
    </WorkspaceProvider>
  );
}

export default function App() {
  const lite = isLitePath();

  if (lite) {
    return (
      <WorkspaceProvider mode="lite">
        <AppShell />
      </WorkspaceProvider>
    );
  }

  return <FullAppRedirect />;
}
