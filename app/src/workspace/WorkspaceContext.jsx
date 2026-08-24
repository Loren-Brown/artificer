import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  bindNewWorkspace,
  clearRootHandle,
  openOrRestoreWorkspace,
} from "@resume/filesystem-core";
import { createResumeCore } from "@resume/resume-core";
import { createPromptCore } from "@resume/prompt-core";
import {
  createResumeToolDefs,
  registerToolsOnWebMcp,
  unregisterToolsOnWebMcp,
} from "@resume/mcp-core";
import { setClientRuntime } from "../clientRuntime.js";

const WorkspaceContext = createContext(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace requires WorkspaceProvider");
  return ctx;
}

export function WorkspaceProvider({ children }) {
  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState("");
  const [root, setRoot] = useState(null);
  const [resume, setResume] = useState(null);
  const [prompts, setPrompts] = useState(null);
  const [toolDefs, setToolDefs] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { handle } = await openOrRestoreWorkspace();
        if (cancelled) return;
        if (!handle) {
          setPhase("gate");
          return;
        }
        await boot(handle);
        if (!cancelled) setPhase("ready");
      } catch (err) {
        if (!cancelled) {
          setError(err.message || String(err));
          setPhase("gate");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function boot(handle) {
    setRoot(handle);
    const resumeApi = await createResumeCore({ root: handle });
    const promptApi = createPromptCore({ root: handle });
    const defs = createResumeToolDefs({
      resume: resumeApi,
      prompts: promptApi,
    });
    setResume(resumeApi);
    setPrompts(promptApi);
    setToolDefs(defs);
    setClientRuntime({ resume: resumeApi, prompts: promptApi, toolDefs: defs });
    await registerToolsOnWebMcp(defs);
  }

  useEffect(() => {
    return () => {
      if (toolDefs.length) {
        void unregisterToolsOnWebMcp(toolDefs);
      }
    };
  }, [toolDefs]);

  async function openExisting() {
    setBusy(true);
    setError("");
    try {
      const handle = await bindNewWorkspace({ createNew: false });
      await boot(handle);
      setPhase("ready");
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function createNew() {
    setBusy(true);
    setError("");
    try {
      const handle = await bindNewWorkspace({ createNew: true });
      await boot(handle);
      setPhase("ready");
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function changeWorkspace() {
    await clearRootHandle();
    if (toolDefs.length) await unregisterToolsOnWebMcp(toolDefs);
    setClientRuntime({});
    setResume(null);
    setPrompts(null);
    setToolDefs([]);
    setRoot(null);
    setPhase("gate");
  }

  const value = useMemo(
    () => ({
      phase,
      error,
      busy,
      root,
      resume,
      prompts,
      toolDefs,
      openExisting,
      createNew,
      changeWorkspace,
    }),
    [phase, error, busy, root, resume, prompts, toolDefs],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
