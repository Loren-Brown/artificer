const PROJECT_KEYS = [
  "order",
  "name",
  "_name",
  "category",
  "roles",
  "company",
  "team",
  "school",
  "start_date",
  "end_date",
  "current_project",
  "summary",
  "_summary",
  "bullets",
  "challenges",
  "_challenges",
  "lessons_learned",
  "_lessons_learned",
  "scale_and_scope",
  "measurable_results",
  "decisions_and_tradeoffs",
  "technologies",
  "tags",
];

const EXPERIENCE_KEYS = [
  "order",
  "company",
  "title",
  "teams",
  "location",
  "start_date",
  "end_date",
  "current",
  "summary",
  "skills",
  "silent_tags",
  "languages",
  "frameworks",
  "platforms",
  "tools",
  "projects",
  "committees",
];

const EDUCATION_KEYS = [
  "order",
  "type",
  "name",
  "location",
  "program_name",
  "degree",
  "graduation_date",
  "start_date",
  "end_date",
  "contact",
  "highlights",
];

const GENERAL_KEYS = [
  "name",
  "title",
  "contact",
  "links",
  "summary",
  "career_goals",
  "specialties",
  "strengths",
  "interests",
  "disinterests",
];

const SKILLS_KEYS = ["categories"];
const CERTIFICATION_KEYS = [
  "order",
  "name",
  "issuer",
  "issued_date",
  "expired_date",
  "url",
  "tags",
];

const NESTED_KEY_ORDERS = {
  roles: ["type", "description"],
  bullets: ["text", "tags"],
  contact: ["location", "address", "website", "phone", "email"],
  links: ["label", "url"],
  categories: ["order", "name", "items"],
  items: ["name", "tags"],
  career_goals: ["short_term", "long_term"],
};

const FILE_ITEM_ORDERS = {
  "projects.json": PROJECT_KEYS,
  "experience.json": EXPERIENCE_KEYS,
  "education.json": EDUCATION_KEYS,
  "certifications.json": CERTIFICATION_KEYS,
};

const FILE_ROOT_ORDERS = {
  "general.json": GENERAL_KEYS,
  "skills.json": SKILLS_KEYS,
};

function orderObject(value, keyOrder = []) {
  if (Array.isArray(value)) {
    return value.map((item) => orderObject(item, keyOrder));
  }

  if (value && typeof value === "object") {
    const ordered = {};

    for (const key of keyOrder) {
      if (!Object.hasOwn(value, key)) continue;
      const nestedOrder = NESTED_KEY_ORDERS[key] ?? [];
      ordered[key] = orderObject(value[key], nestedOrder);
    }

    for (const key of Object.keys(value).sort()) {
      if (Object.hasOwn(ordered, key)) continue;
      const nestedOrder = NESTED_KEY_ORDERS[key] ?? [];
      ordered[key] = orderObject(value[key], nestedOrder);
    }

    return ordered;
  }

  return value;
}

export function formatData(data, fileName) {
  if (FILE_ITEM_ORDERS[fileName]) {
    if (!Array.isArray(data)) {
      throw new Error(`${fileName} must be a JSON array`);
    }
    return orderObject(data, FILE_ITEM_ORDERS[fileName]);
  }

  if (FILE_ROOT_ORDERS[fileName]) {
    if (Array.isArray(data) || typeof data !== "object" || data === null) {
      throw new Error(`${fileName} must be a JSON object`);
    }
    return orderObject(data, FILE_ROOT_ORDERS[fileName]);
  }

  return orderObject(data, []);
}
