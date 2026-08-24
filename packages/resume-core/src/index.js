import { bus } from "./events.js";
import { createDataStore, ALL_TYPES, ARRAY_TYPES } from "./dataStore.js";
import { createResumeHistory } from "./resumeHistory.js";
import { compileLatexWithSwiftLatex } from "./compile.js";
import {
  sanitizeLatexContent,
  sanitizeLatexFileName,
} from "./resumeNames.js";
import { stripPrivateFields } from "./stripPrivate.js";
import {
  listNames,
  pathExists,
  readBinaryFile,
  readTextFile,
  writeBinaryFile,
  writeTextFile,
} from "../../filesystem-core/src/index.js";

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function readCurrentName(root) {
  if (!(await pathExists(root, ["app", ".current"], "file"))) return null;
  const text = (await readTextFile(root, ["app", ".current"])).trim();
  return text || null;
}

async function writeCurrentName(root, name) {
  await writeTextFile(root, ["app", ".current"], `${name}\n`);
}

/**
 * Create the in-browser resume API for the SPA.
 * @param {{ root: FileSystemDirectoryHandle }} options
 */
export async function createResumeCore({ root }) {
  const store = await createDataStore({ root });
  const history = createResumeHistory({ root });

  async function listTexFiles() {
    const names = await listNames(root, ["resumes"], { files: true });
    return names.filter((n) => /\.tex$/i.test(n));
  }

  async function compileCurrent() {
    const current = await readCurrentName(root);
    if (!current) {
      return {
        compiled: false,
        pdf: null,
        error: "No resume selected",
        logTail: "",
      };
    }
    const tex = await readTextFile(root, ["resumes", current]);
    try {
      const { pdf, log } = await compileLatexWithSwiftLatex(tex, {
        fileName: current,
      });
      const pdfName = current.replace(/\.tex$/i, ".pdf");
      await writeBinaryFile(root, ["app", "compiled", pdfName], pdf);
      if (log) {
        await writeTextFile(
          root,
          ["app", "logs", current.replace(/\.tex$/i, ".swiftlatex.log")],
          log,
        );
      }
      bus.emit("pdf:ready", { file: pdfName, current });
      return {
        compiled: true,
        pdf: pdfName,
        current,
        file: current,
        logTail: String(log || "").slice(-2000),
      };
    } catch (err) {
      const logTail = String(err.log || err.message || err).slice(-2000);
      return {
        compiled: false,
        pdf: null,
        current,
        file: current,
        error: err.message || "Compile failed",
        logTail,
      };
    }
  }

  async function getStatus() {
    const current = await readCurrentName(root);
    if (!current) {
      return { current: null, file: null, pdf: null };
    }
    const pdfName = current.replace(/\.tex$/i, ".pdf");
    const hasPdf = await pathExists(root, ["app", "compiled", pdfName], "file");
    const hist = await history.meta(current);
    return {
      current,
      file: current,
      pdf: hasPdf ? pdfName : null,
      history: hist,
    };
  }

  const api = {
    bus,
    store,

    async listResumes() {
      const items = await listTexFiles();
      const current = await readCurrentName(root);
      return { items, current };
    },

    async getPublicResumeStatus() {
      return getStatus();
    },

    async getPublicResumeText() {
      const current = await readCurrentName(root);
      if (!current) {
        throw httpError(404, "No resume selected");
      }
      return readTextFile(root, ["resumes", current]);
    },

    async getPublicResumePdfBytes() {
      const status = await getStatus();
      if (!status.pdf) throw httpError(404, "PDF not compiled yet");
      return readBinaryFile(root, ["app", "compiled", status.pdf]);
    },

    async selectResume(name) {
      const safe = sanitizeLatexFileName(name);
      if (!(await pathExists(root, ["resumes", safe], "file"))) {
        throw httpError(404, `Resume not found: ${safe}`);
      }
      await writeCurrentName(root, safe);
      const compiled = await compileCurrent();
      bus.emit("resume:updated", { current: safe });
      if (compiled.compiled === false) {
        const err = new Error(compiled.error || "Compile failed");
        err.status = 422;
        err.body = compiled;
        throw err;
      }
      return { name: safe, file: safe, ...compiled };
    },

    async storeResume(filename, content) {
      const safe = sanitizeLatexFileName(filename);
      const text = sanitizeLatexContent(content);
      await writeTextFile(root, ["resumes", safe], text);
      await history.push(safe, text);
      const current = await readCurrentName(root);
      if (current === safe) {
        const compiled = await compileCurrent();
        bus.emit("resume:updated", { current: safe });
        return { name: safe, file: safe, ...compiled };
      }
      bus.emit("resume:updated", { current });
      return { name: safe, file: safe, compiled: null };
    },

    async updateSelectedResume(content, filenameHeader) {
      const current = await readCurrentName(root);
      if (!current) throw httpError(400, "No resume selected");
      if (filenameHeader) {
        const safe = sanitizeLatexFileName(filenameHeader);
        if (safe !== current) {
          throw httpError(400, "Filename must match the selected resume");
        }
      }
      return api.storeResume(current, content);
    },

    async getResumeHistory(name) {
      const current = name || (await readCurrentName(root));
      if (!current) throw httpError(400, "No resume selected");
      return history.meta(sanitizeLatexFileName(current));
    },

    async undoResume(name) {
      const current = name || (await readCurrentName(root));
      const safe = sanitizeLatexFileName(current);
      const moved = await history.undo(safe);
      await writeTextFile(root, ["resumes", safe], moved.content);
      const compiled = await compileCurrent();
      bus.emit("resume:updated", { current: safe });
      const body = { name: safe, file: safe, history: moved.history, ...compiled };
      if (compiled.compiled === false) {
        const err = new Error(compiled.error || "Compile failed");
        err.status = 422;
        err.body = body;
        throw err;
      }
      return body;
    },

    async redoResume(name) {
      const current = name || (await readCurrentName(root));
      const safe = sanitizeLatexFileName(current);
      const moved = await history.redo(safe);
      await writeTextFile(root, ["resumes", safe], moved.content);
      const compiled = await compileCurrent();
      bus.emit("resume:updated", { current: safe });
      const body = { name: safe, file: safe, history: moved.history, ...compiled };
      if (compiled.compiled === false) {
        const err = new Error(compiled.error || "Compile failed");
        err.status = 422;
        err.body = body;
        throw err;
      }
      return body;
    },

    async listExamples() {
      const names = await listNames(root, ["resume-examples"], { files: true });
      return { items: names };
    },

    async getExample(name) {
      const text = await readTextFile(root, ["resume-examples", name]);
      return { name, content: text };
    },

    // Data CRUD (private — includes _ fields)
    listItems: (type) => store.list(type),
    getItem: (type, index) => store.get(type, index),
    createItem: (type, item) => store.create(type, item),
    updateItem: (type, index, item) => store.update(type, index, item),
    deleteItem: (type, index) => store.remove(type, index),
    reorderItems: (type, indexes) => store.reorder(type, indexes),
    getGeneral: () => store.getSingleton("general"),
    putGeneral: (data) => store.putSingleton("general", data),
    getSkills: () => store.getSingleton("skills"),
    putSkills: (data) => store.putSingleton("skills", data),
    listSkillCategories: () => store.listSkillCategories(),
    createSkillCategory: (item) => store.createSkillCategory(item),
    updateSkillCategory: (index, item) => store.updateSkillCategory(index, item),
    deleteSkillCategory: (index) => store.deleteSkillCategory(index),
    reorderSkillCategories: (indexes) => store.reorderSkillCategories(indexes),

    // Public (stripped) — for agent tools
    async getPublicDocument(type) {
      if (ARRAY_TYPES.includes(type)) {
        const { items } = await store.list(type);
        return { items: stripPrivateFields(items) };
      }
      const data = await store.getSingleton(type);
      return stripPrivateFields(data);
    },
    async getPublicItem(type, index) {
      const { item } = await store.get(type, index);
      return { index, item: stripPrivateFields(item) };
    },
    listPublicTypes() {
      return { types: ALL_TYPES };
    },

    compileCurrent,

    /** Compile the selected resume without changing selection. */
    async compileSelectedResume() {
      const compiled = await compileCurrent();
      bus.emit("resume:updated", {
        current: compiled.current || (await readCurrentName(root)),
      });
      if (compiled.compiled === false) {
        const err = new Error(compiled.error || "Compile failed");
        err.status = 422;
        err.body = compiled;
        throw err;
      }
      return compiled;
    },
  };

  return api;
}

export { ALL_TYPES, ARRAY_TYPES };
export { stripPrivateFields } from "./stripPrivate.js";
export { bus } from "./events.js";
