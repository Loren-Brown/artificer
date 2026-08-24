import { useId, useState } from "react";
import {
  CertificationsTab,
  EducationTab,
  ExperienceTab,
  GeneralTab,
  ProjectsTab,
  ResumeTab,
  SkillsTab,
} from "./tabs/Tabs.jsx";
import { AgentTab } from "./tabs/AgentTab.jsx";
import {
  DATA_TYPE_TABS,
  DataTypeTabList,
  dataTypePanelProps,
} from "./components/DataTypeTabList.jsx";
import { AgentChat } from "./components/AgentChat.jsx";
import { SettingsButton } from "./components/SettingsButton.jsx";
import {
  WorkspaceProvider,
  useWorkspace,
} from "./workspace/WorkspaceContext.jsx";
import { WorkspaceGate } from "./workspace/WorkspaceGate.jsx";

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
  const { phase, changeWorkspace, root } = useWorkspace();
  const [active, setActiveState] = useState(readCachedActiveTab);
  const tabPrefix = useId();
  const current =
    DATA_TYPE_TABS.find((tab) => tab.id === active) ?? DATA_TYPE_TABS[0];
  const Active = TAB_COMPONENTS[current.id];
  const workspaceName = root?.name ? String(root.name) : "";

  function setActive(nextId) {
    setActiveState(nextId);
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, nextId);
    } catch {
      /* ignore */
    }
  }

  if (phase !== "ready") {
    return <WorkspaceGate />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <img
            className="app-brand-icon"
            src="/favicon.svg"
            alt=""
            width="36"
            height="36"
          />
          <h1>Resume Builder</h1>
        </div>
        <SettingsButton
          workspaceName={workspaceName}
          onChangeWorkspace={changeWorkspace}
        />
      </header>
      <DataTypeTabList
        activeId={active}
        onChange={setActive}
        idPrefix={tabPrefix}
      />
      <div {...dataTypePanelProps(tabPrefix, current.id)}>
        <Active />
      </div>
      <AgentChat />
    </div>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  );
}
