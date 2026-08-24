import { parseDate } from "../utils.js";

/**
 * Map dated list rows into Timeline entry objects.
 * Kept separate from Timeline.jsx so callers can avoid loading vis-timeline.
 */
export function timelineFromDatedItems(
  rows,
  { label, startKey, endKey, currentKey },
) {
  return rows.map(({ item, index }) => {
    const start = parseDate(item[startKey]);
    const ongoing = Boolean(currentKey && item[currentKey]);
    let end = parseDate(item[endKey]);
    if (ongoing) end = null;
    return {
      id: `${index}-${label(item)}`,
      label: label(item),
      startKey: start,
      endKey: end,
      ongoing,
      // No end date and not ongoing → single-day point (e.g. certs without expiry).
      point: start != null && end == null && !ongoing,
    };
  });
}
