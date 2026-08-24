import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { formatData } from "./format.js";
import {
  listNames,
  pathExists,
  readTextFile,
  writeTextFile,
} from "../../filesystem-core/src/index.js";

export const ARRAY_TYPES = ["experience", "education", "projects", "certifications"];
export const SINGLETON_TYPES = ["general", "skills"];
export const ALL_TYPES = [...SINGLETON_TYPES, ...ARRAY_TYPES];

function fileNameFor(type) {
  return `${type}.json`;
}

function httpError(status, message, errors) {
  const err = new Error(message);
  err.status = status;
  if (errors) err.errors = errors;
  return err;
}

function stripEmptyStrings(value) {
  if (Array.isArray(value)) return value.map(stripEmptyStrings);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === "") continue;
      out[k] = stripEmptyStrings(v);
    }
    return out;
  }
  return value;
}

async function loadAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const names = [
    "common",
    "general",
    "skills",
    "experience",
    "education",
    "projects",
    "certifications",
  ];
  for (const name of names) {
    const res = await fetch(`/schemas/${name}.schema.json`);
    if (!res.ok) continue;
    const schema = await res.json();
    try {
      ajv.addSchema(schema, schema.$id || `${name}.schema.json`);
    } catch {
      /* already added */
    }
  }
  return ajv;
}

/**
 * @param {{ root: FileSystemDirectoryHandle }} options
 */
export async function createDataStore({ root }) {
  const ajv = await loadAjv();

  async function readJson(type) {
    const file = fileNameFor(type);
    const segments = ["resume-data", file];
    if (!(await pathExists(root, segments, "file"))) {
      if (ARRAY_TYPES.includes(type)) return [];
      if (type === "skills") return { categories: [] };
      return {};
    }
    const text = await readTextFile(root, segments);
    return JSON.parse(text || (ARRAY_TYPES.includes(type) ? "[]" : "{}"));
  }

  async function writeJson(type, data) {
    const file = fileNameFor(type);
    const cleaned = stripEmptyStrings(data);
    const formatted = formatData(cleaned, file);
    const schemaId = `${type}.schema.json`;
    const validate = ajv.getSchema(schemaId) || ajv.getSchema(`https://resume.local/${schemaId}`);
    // Try common $id patterns from files
    let validator = validate;
    if (!validator) {
      for (const key of Object.keys(ajv.schemas || {})) {
        if (key.includes(type)) {
          validator = ajv.getSchema(key);
          if (validator) break;
        }
      }
    }
    if (validator) {
      const ok = validator(formatted);
      if (!ok) {
        throw httpError(400, `Invalid ${file}`, validator.errors);
      }
    }
    await writeTextFile(
      root,
      ["resume-data", file],
      `${JSON.stringify(formatted, null, 2)}\n`,
    );
    return formatted;
  }

  function assertArrayType(type) {
    if (!ARRAY_TYPES.includes(type)) {
      throw httpError(400, `Unknown array type: ${type}`);
    }
  }

  return {
    async list(type) {
      assertArrayType(type);
      const items = await readJson(type);
      return { items: Array.isArray(items) ? items : [] };
    },
    async get(type, index) {
      assertArrayType(type);
      const items = await readJson(type);
      if (!items[index]) throw httpError(404, "Item not found");
      return { index, item: items[index] };
    },
    async create(type, item) {
      assertArrayType(type);
      const items = await readJson(type);
      const next = { ...item };
      if (!Number.isInteger(next.order)) {
        const max = items.reduce((m, it) => Math.max(m, it.order ?? -1), -1);
        next.order = max + 1;
      }
      items.push(next);
      await writeJson(type, items);
      return { index: items.length - 1, item: next };
    },
    async update(type, index, item) {
      assertArrayType(type);
      const items = await readJson(type);
      if (!items[index]) throw httpError(404, "Item not found");
      const prev = items[index];
      const next = { ...item };
      if (!Number.isInteger(next.order)) next.order = prev.order;
      items[index] = next;
      await writeJson(type, items);
      return { index, item: next };
    },
    async remove(type, index) {
      assertArrayType(type);
      const items = await readJson(type);
      if (!items[index]) throw httpError(404, "Item not found");
      items.splice(index, 1);
      items.forEach((it, i) => {
        it.order = i;
      });
      await writeJson(type, items);
      return { ok: true };
    },
    async reorder(type, indexes) {
      assertArrayType(type);
      const items = await readJson(type);
      if (!Array.isArray(indexes) || indexes.length !== items.length) {
        throw httpError(400, "indexes must list every item once");
      }
      const next = indexes.map((i, order) => {
        if (!items[i]) throw httpError(400, `Invalid index ${i}`);
        return { ...items[i], order };
      });
      await writeJson(type, next);
      return { items: next };
    },
    async getSingleton(type) {
      if (!SINGLETON_TYPES.includes(type)) throw httpError(400, `Unknown type ${type}`);
      return readJson(type);
    },
    async putSingleton(type, data) {
      if (!SINGLETON_TYPES.includes(type)) throw httpError(400, `Unknown type ${type}`);
      return writeJson(type, data);
    },
    async listSkillCategories() {
      const skills = await readJson("skills");
      return { items: skills.categories || [] };
    },
    async createSkillCategory(item) {
      const skills = await readJson("skills");
      const categories = skills.categories || [];
      const next = { ...item };
      if (!Number.isInteger(next.order)) next.order = categories.length;
      categories.push(next);
      await writeJson("skills", { ...skills, categories });
      return { index: categories.length - 1, item: next };
    },
    async updateSkillCategory(index, item) {
      const skills = await readJson("skills");
      const categories = skills.categories || [];
      if (!categories[index]) throw httpError(404, "Category not found");
      const next = { ...item };
      if (!Number.isInteger(next.order)) next.order = categories[index].order;
      categories[index] = next;
      await writeJson("skills", { ...skills, categories });
      return { index, item: next };
    },
    async deleteSkillCategory(index) {
      const skills = await readJson("skills");
      const categories = skills.categories || [];
      if (!categories[index]) throw httpError(404, "Category not found");
      categories.splice(index, 1);
      categories.forEach((c, i) => {
        c.order = i;
      });
      await writeJson("skills", { ...skills, categories });
      return { ok: true };
    },
    async reorderSkillCategories(indexes) {
      const skills = await readJson("skills");
      const categories = skills.categories || [];
      const next = indexes.map((i, order) => ({ ...categories[i], order }));
      await writeJson("skills", { ...skills, categories: next });
      return { items: next };
    },
    async listDataFiles() {
      return listNames(root, ["resume-data"], { files: true });
    },
  };
}
