import {
  listNames,
  pathExists,
  readTextFile,
  removeFile,
  writeTextFile,
} from "../../filesystem-core/src/index.js";

const MAX_HISTORY = 50;

function historyDir(basename) {
  const stem = String(basename).replace(/\.tex$/i, "");
  return ["app", "history", stem];
}

async function readIndex(root, basename) {
  const segments = [...historyDir(basename), "index.json"];
  if (!(await pathExists(root, segments, "file"))) {
    return { entries: [], cursor: -1 };
  }
  return JSON.parse(await readTextFile(root, segments));
}

async function writeIndex(root, basename, index) {
  await writeTextFile(
    root,
    [...historyDir(basename), "index.json"],
    `${JSON.stringify(index, null, 2)}\n`,
  );
}

/**
 * @param {{ root: FileSystemDirectoryHandle }} options
 */
export function createResumeHistory({ root }) {
  return {
    async push(basename, content) {
      const index = await readIndex(root, basename);
      // Drop redo branch
      if (index.cursor >= 0 && index.cursor < index.entries.length - 1) {
        const drop = index.entries.splice(index.cursor + 1);
        for (const name of drop) {
          try {
            await removeFile(root, [...historyDir(basename), name]);
          } catch {
            /* ignore */
          }
        }
      }
      const version = `v${String(index.entries.length + 1).padStart(4, "0")}.tex`;
      await writeTextFile(root, [...historyDir(basename), version], content);
      index.entries.push(version);
      while (index.entries.length > MAX_HISTORY) {
        const old = index.entries.shift();
        try {
          await removeFile(root, [...historyDir(basename), old]);
        } catch {
          /* ignore */
        }
      }
      index.cursor = index.entries.length - 1;
      await writeIndex(root, basename, index);
      return {
        canUndo: index.cursor > 0,
        canRedo: false,
      };
    },

    async meta(basename) {
      const index = await readIndex(root, basename);
      return {
        canUndo: index.cursor > 0,
        canRedo: index.cursor >= 0 && index.cursor < index.entries.length - 1,
        entries: index.entries,
        cursor: index.cursor,
      };
    },

    async undo(basename) {
      const index = await readIndex(root, basename);
      if (index.cursor <= 0) {
        const err = new Error("Nothing to undo");
        err.status = 400;
        throw err;
      }
      index.cursor -= 1;
      const file = index.entries[index.cursor];
      const content = await readTextFile(root, [...historyDir(basename), file]);
      await writeIndex(root, basename, index);
      return {
        content,
        history: {
          canUndo: index.cursor > 0,
          canRedo: index.cursor < index.entries.length - 1,
        },
      };
    },

    async redo(basename) {
      const index = await readIndex(root, basename);
      if (index.cursor >= index.entries.length - 1) {
        const err = new Error("Nothing to redo");
        err.status = 400;
        throw err;
      }
      index.cursor += 1;
      const file = index.entries[index.cursor];
      const content = await readTextFile(root, [...historyDir(basename), file]);
      await writeIndex(root, basename, index);
      return {
        content,
        history: {
          canUndo: index.cursor > 0,
          canRedo: index.cursor < index.entries.length - 1,
        },
      };
    },

    async listEntries(basename) {
      return readIndex(root, basename);
    },

    async getEntry(basename, versionFile) {
      return readTextFile(root, [...historyDir(basename), versionFile]);
    },
  };
}

export async function listHistoryBasenames(root) {
  try {
    return listNames(root, ["app", "history"], { dirs: true, files: false });
  } catch {
    return [];
  }
}
