/**
 * In-memory File System Access API root (lite mode + tests).
 */

function notFound(message = "Not found") {
  const err = new Error(message);
  err.name = "NotFoundError";
  return err;
}

function typeMismatch(message = "Type mismatch") {
  const err = new Error(message);
  err.name = "TypeMismatchError";
  return err;
}

class MemFile {
  constructor(bytes = new Uint8Array()) {
    this.bytes =
      bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  }

  async getFile() {
    const bytes = this.bytes;
    const copy = bytes.slice();
    return {
      async text() {
        return new TextDecoder().decode(copy);
      },
      async arrayBuffer() {
        return copy.buffer.slice(
          copy.byteOffset,
          copy.byteOffset + copy.byteLength,
        );
      },
    };
  }
}

class MemFileHandle {
  constructor(file = new MemFile()) {
    this.kind = "file";
    this._file = file;
  }

  getFile() {
    return this._file.getFile();
  }

  createWritable() {
    const file = this._file;
    const chunks = [];
    return {
      async write(data) {
        if (typeof data === "string") {
          chunks.push(new TextEncoder().encode(data));
        } else if (data instanceof Uint8Array) {
          chunks.push(data.slice());
        } else if (data instanceof ArrayBuffer) {
          chunks.push(new Uint8Array(data.slice(0)));
        } else {
          chunks.push(new Uint8Array(data));
        }
      },
      async close() {
        const total = chunks.reduce((n, c) => n + c.length, 0);
        const out = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          out.set(c, offset);
          offset += c.length;
        }
        file.bytes = out;
      },
    };
  }
}

class MemDirectoryHandle {
  constructor(name = "", entries = new Map()) {
    this.kind = "directory";
    this.name = name;
    this._entries = entries;
  }

  async getDirectoryHandle(name, { create = false } = {}) {
    const existing = this._entries.get(name);
    if (existing) {
      if (existing.kind !== "directory") throw typeMismatch();
      return existing;
    }
    if (!create) throw notFound(`Missing directory ${name}`);
    const dir = new MemDirectoryHandle(name);
    this._entries.set(name, dir);
    return dir;
  }

  async getFileHandle(name, { create = false } = {}) {
    const existing = this._entries.get(name);
    if (existing) {
      if (existing.kind !== "file") throw typeMismatch();
      return existing;
    }
    if (!create) throw notFound(`Missing file ${name}`);
    const handle = new MemFileHandle();
    this._entries.set(name, handle);
    return handle;
  }

  async removeEntry(name, { recursive = false } = {}) {
    const existing = this._entries.get(name);
    if (!existing) throw notFound(`Missing entry ${name}`);
    if (
      existing.kind === "directory" &&
      existing._entries.size > 0 &&
      !recursive
    ) {
      const err = new Error("Directory not empty");
      err.name = "InvalidModificationError";
      throw err;
    }
    this._entries.delete(name);
  }

  async *entries() {
    const sorted = [...this._entries.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    for (const [name, handle] of sorted) {
      yield [name, handle];
    }
  }

  async queryPermission() {
    return "granted";
  }

  async requestPermission() {
    return "granted";
  }
}

/** Create an empty workspace root handle. */
export function createMemoryRoot() {
  return new MemDirectoryHandle("root");
}

export { MemDirectoryHandle, MemFileHandle, MemFile };
