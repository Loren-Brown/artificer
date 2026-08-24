/** Parse MM-DD-YYYY into a sortable YYYYMMDD number, or null. */
export function parseDate(value) {
  if (!value || typeof value !== "string") return null;
  const match =
    /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return year * 10000 + month * 100 + day;
}

export function dateToLabel(key) {
  if (key == null) return "";
  const year = Math.floor(key / 10000);
  const month = Math.floor((key % 10000) / 100);
  const day = key % 100;
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}-${year}`;
}

export function dateKeyToStartDate(key) {
  const year = Math.floor(key / 10000);
  const month = Math.floor((key % 10000) / 100);
  const day = key % 100;
  return new Date(year, month - 1, day);
}

export function dateKeyToEndDate(key) {
  const year = Math.floor(key / 10000);
  const month = Math.floor((key % 10000) / 100);
  const day = key % 100;
  return new Date(year, month - 1, day, 23, 59, 59);
}

export function currentDateValue() {
  const now = new Date();
  return (
    now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
  );
}

/** MM-DD-YYYY → YYYY-MM-DD for `<input type="date">`. */
export function toHtmlDate(value) {
  const key = parseDate(value);
  if (key == null) return "";
  const year = Math.floor(key / 10000);
  const month = Math.floor((key % 10000) / 100);
  const day = key % 100;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** YYYY-MM-DD → MM-DD-YYYY storage format. */
export function fromHtmlDate(value) {
  if (!value || typeof value !== "string") return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return "";
  const [, y, m, d] = match;
  const converted = `${m}-${d}-${y}`;
  return parseDate(converted) == null ? "" : converted;
}

/**
 * Plain-language span between two MM-DD-YYYY dates.
 * Uses weeks up through 10 weeks; longer spans use months.
 * When `ongoing` is true (or end is missing), end defaults to today.
 */
export function formatDurationPlain(startDate, endDate, { ongoing = false } = {}) {
  const startKey = parseDate(startDate);
  if (startKey == null) return "";
  const endKey =
    ongoing || !endDate ? currentDateValue() : parseDate(endDate);
  if (endKey == null) return "";

  const start = dateKeyToStartDate(startKey);
  const end = dateKeyToStartDate(endKey);
  const dayMs = 1000 * 60 * 60 * 24;
  const days = Math.max(0, Math.round((end - start) / dayMs));
  const weeks = Math.max(days === 0 ? 0 : 1, Math.round(days / 7));

  if (weeks <= 10) {
    if (weeks <= 0) return "less than a week";
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }

  const months = Math.max(1, Math.round(days / 30.4375));
  return months === 1 ? "1 month" : `${months} months`;
}

export function withIndex(items) {
  return items.map((item, index) => ({ item, index }));
}

export function sortByOrderAsc(rows) {
  return [...rows].sort((a, b) => {
    const oa = Number.isInteger(a.item.order) ? a.item.order : Number.MAX_SAFE_INTEGER;
    const ob = Number.isInteger(b.item.order) ? b.item.order : Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return a.index - b.index;
  });
}

export function sortByDateDesc(rows, getDate) {
  return [...rows].sort((a, b) => {
    const da = getDate(a.item);
    const db = getDate(b.item);
    if (da == null && db == null) return a.index - b.index;
    if (da == null) return 1;
    if (db == null) return -1;
    if (db !== da) return db - da;
    return a.index - b.index;
  });
}

/**
 * Rows that break newest-first date order in the current display sequence.
 * Returns Map<fileIndex, string[]> of human-readable issue reasons.
 */
export function collectOrderIssues(rows, getDate) {
  const issues = new Map();
  if (!getDate) return issues;

  const add = (index, message) => {
    if (!issues.has(index)) issues.set(index, []);
    issues.get(index).push(message);
  };

  const byOrder = sortByOrderAsc(rows);
  let lastDated = null;

  for (let i = 0; i < byOrder.length; i++) {
    const row = byOrder[i];
    const date = getDate(row.item);

    if (date == null) {
      const hasDatedAfter = byOrder
        .slice(i + 1)
        .some((entry) => getDate(entry.item) != null);
      if (hasDatedAfter) {
        add(
          row.index,
          "Missing a date while dated entries appear below it in the list.",
        );
      }
      continue;
    }

    if (lastDated != null && date > lastDated) {
      add(
        row.index,
        "Newer than the dated entry above it (list should be newest-first).",
      );
    }
    lastDated = date;
  }

  return issues;
}

/** @deprecated Prefer collectOrderIssues — kept for callers expecting a Set. */
export function isOrderMisaligned(rows, getDate) {
  return new Set(collectOrderIssues(rows, getDate).keys());
}

function jobEndKey(job) {
  if (job?.current) return currentDateValue();
  return parseDate(job?.end_date);
}

function jobEndLabel(job) {
  if (job?.current) return "present";
  return job?.end_date ?? "?";
}

/**
 * Validate a project against its matching experience.company employment window.
 * Returns an array of human-readable issue strings (empty if OK / not applicable).
 */
export function collectEmploymentDateIssues(project, experienceItems = []) {
  const issues = [];
  const company = project?.company?.trim();
  if (!company) return issues;

  const job = experienceItems.find(
    (entry) => entry?.company?.trim() === company,
  );
  if (!job) {
    issues.push(`No experience entry found for company “${company}”.`);
    return issues;
  }

  const jobStart = parseDate(job.start_date);
  const jobEnd = jobEndKey(job);
  const projectStart = parseDate(project.start_date);
  const projectEnd = project.current_project
    ? currentDateValue()
    : parseDate(project.end_date);
  const projectEndLabel = project.current_project
    ? "present"
    : (project.end_date ?? "?");

  if (projectStart != null && jobStart != null && projectStart < jobStart) {
    issues.push(
      `Project start (${project.start_date}) is before ${company} employment start (${job.start_date}).`,
    );
  }
  if (projectStart != null && jobEnd != null && projectStart > jobEnd) {
    issues.push(
      `Project start (${project.start_date}) is after ${company} employment end (${jobEndLabel(job)}).`,
    );
  }
  if (projectEnd != null && jobStart != null && projectEnd < jobStart) {
    issues.push(
      `Project end (${projectEndLabel}) is before ${company} employment start (${job.start_date}).`,
    );
  }
  if (projectEnd != null && jobEnd != null && projectEnd > jobEnd) {
    issues.push(
      `Project end (${projectEndLabel}) is after ${company} employment end (${jobEndLabel(job)}).`,
    );
  }

  return issues;
}

/** Merge issue maps (index → string[]), concatenating reasons per index. */
export function mergeIssueMaps(...maps) {
  const merged = new Map();
  for (const map of maps) {
    if (!map) continue;
    for (const [index, messages] of map) {
      if (!merged.has(index)) merged.set(index, []);
      merged.get(index).push(...messages);
    }
  }
  return merged;
}

/** Format issue reasons for tooltip / accessible text. */
export function formatIssueTooltip(issues) {
  if (!issues?.length) return "";
  if (issues.length === 1) return `• ${issues[0]}`;
  return issues.map((issue) => `• ${issue}`).join("\n");
}

/**
 * Vertical timeline markers for experience start/end dates.
 * markers: [{ id, dateKey, label, kind: 'start'|'end' }]
 */
export function employmentTimelineMarkers(experienceItems = []) {
  const markers = [];
  for (const job of experienceItems) {
    const company = job?.company?.trim();
    if (!company) continue;
    const start = parseDate(job.start_date);
    if (start != null) {
      markers.push({
        id: `job-${company}-start`,
        dateKey: start,
        label: `${company} start`,
        kind: "start",
      });
    }
    const end = jobEndKey(job);
    if (end != null) {
      markers.push({
        id: `job-${company}-end`,
        dateKey: end,
        label: job.current ? `${company} present` : `${company} end`,
        kind: job.current ? "present" : "end",
      });
    }
  }
  return markers;
}
