import { useEffect, useId, useMemo, useRef } from "react";
import { DataSet, Timeline as VisTimeline } from "vis-timeline/standalone";
import "vis-timeline/styles/vis-timeline-graph2d.min.css";
import {
  currentDateValue,
  dateKeyToEndDate,
  dateKeyToStartDate,
  dateToLabel,
} from "../utils.js";

function colorForIndex(index) {
  const hue = (index * 47) % 140;
  return `hsl(${160 + hue * 0.35}, 42%, ${38 + (index % 3) * 6}%)`;
}

function markersSignature(markers) {
  return (markers ?? [])
    .map((marker) => `${marker.id}:${marker.dateKey}:${marker.label}`)
    .join("|");
}

/** Stop job markers before they cross the top date axis / labels. */
function clipMarkersBelowAxis(container) {
  if (!container) return;
  const topPanel = container.querySelector(".vis-panel.vis-top");
  const axisHeight = topPanel ? topPanel.getBoundingClientRect().height : 0;
  container.style.setProperty(
    "--job-marker-clip-top",
    `${Math.ceil(axisHeight) + 2}px`,
  );
}

function endOfToday() {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
}

/** Window from earliest data through end of today (never into the future). */
function setWindowThroughToday(timeline, items, markers) {
  const end = endOfToday();
  let earliest = end.getTime();

  for (const item of items) {
    if (item.start) earliest = Math.min(earliest, item.start.getTime());
    if (item.end) earliest = Math.min(earliest, item.end.getTime());
  }
  for (const marker of markers ?? []) {
    if (marker?.dateKey == null) continue;
    earliest = Math.min(earliest, dateKeyToStartDate(marker.dateKey).getTime());
  }

  const start = new Date(earliest);
  // Small left pad so the first item isn't flush against the edge.
  start.setDate(start.getDate() - 14);

  timeline.setOptions({ max: end });
  timeline.setWindow(start, end, { animation: false });
}

/**
 * entries: [{ id, label, startKey (YYYYMMDD|null), endKey (YYYYMMDD|null) }]
 * markers: [{ id, dateKey, label, kind? }] — vertical employment date lines
 */
export function Timeline({
  entries,
  markers = [],
  emptyMessage = "No dated entries to chart.",
}) {
  const headingId = useId();
  const containerRef = useRef(null);
  const timelineRef = useRef(null);
  const markerIdsRef = useRef([]);
  const markerSnapshot = markersSignature(markers);

  const items = useMemo(() => {
    const now = currentDateValue();
    return entries
      .map((entry, index) => {
        const start = entry.startKey ?? entry.startMonth;
        if (start == null) return null;
        const color = colorForIndex(index);
        const isPoint =
          entry.point === true ||
          (entry.point !== false &&
            entry.endKey == null &&
            entry.endMonth == null &&
            !entry.ongoing);

        if (isPoint) {
          return {
            id: entry.id ?? String(index),
            content: entry.label,
            title: `${entry.label}\n${dateToLabel(start)}`,
            start: dateKeyToStartDate(start),
            type: "point",
            // Color the dot via CSS var — background on the item itself becomes a bar.
            style: `--point-color: ${color};`,
            className: "timeline-point",
            startKey: start,
            endKey: null,
            label: entry.label,
            isPoint: true,
          };
        }

        const end = Math.max(entry.endKey ?? entry.endMonth ?? now, start);
        return {
          id: entry.id ?? String(index),
          content: entry.label,
          title: `${entry.label}\n${dateToLabel(start)} → ${dateToLabel(end)}`,
          start: dateKeyToStartDate(start),
          end: dateKeyToEndDate(end),
          type: "range",
          style: `background-color: ${color}; border-color: ${color};`,
          startKey: start,
          endKey: end,
          label: entry.label,
          isPoint: false,
        };
      })
      .filter(Boolean);
  }, [entries]);

  useEffect(() => {
    if (!containerRef.current || (items.length === 0 && markers.length === 0)) {
      if (timelineRef.current) {
        timelineRef.current.destroy();
        timelineRef.current = null;
        markerIdsRef.current = [];
      }
      return undefined;
    }

    const data = new DataSet(
      items.map(({ id, content, title, start, end, style, type, className }) => {
        const item = { id, content, title, start, type, style };
        if (className) item.className = className;
        if (type === "range" && end) item.end = end;
        return item;
      }),
    );

    const options = {
      stack: true,
      stackSubgroups: true,
      selectable: false,
      editable: false,
      multiselect: false,
      zoomable: true,
      moveable: true,
      orientation: "top",
      showCurrentTime: false,
      margin: { item: { horizontal: 2, vertical: 6 }, axis: 8 },
      tooltip: {
        followMouse: true,
        overflowMethod: "cap",
      },
    };

    if (!timelineRef.current) {
      timelineRef.current = new VisTimeline(containerRef.current, data, options);
    } else {
      timelineRef.current.setItems(data);
      timelineRef.current.setOptions(options);
    }

    const timeline = timelineRef.current;
    for (const id of markerIdsRef.current) {
      try {
        timeline.removeCustomTime(id);
      } catch {
        // already removed
      }
    }
    markerIdsRef.current = [];

    for (const marker of markers) {
      if (marker?.dateKey == null || !marker.id) continue;
      const time = dateKeyToStartDate(marker.dateKey);
      timeline.addCustomTime(time, marker.id);
      // Title only — visible label appears via browser tooltip on hover.
      if (typeof timeline.setCustomTimeTitle === "function") {
        timeline.setCustomTimeTitle(marker.label ?? String(marker.id), marker.id);
      }
      markerIdsRef.current.push(marker.id);
    }

    // Keep employment markers fixed if the user drags them.
    const locked = new Map(
      markers
        .filter((marker) => marker?.dateKey != null && marker.id)
        .map((marker) => [marker.id, dateKeyToStartDate(marker.dateKey)]),
    );
    const onTimeChanged = (properties) => {
      const id = properties?.id;
      if (id == null || !locked.has(id)) return;
      timeline.setCustomTime(locked.get(id), id);
    };
    timeline.on("timechanged", onTimeChanged);

    setWindowThroughToday(timeline, items, markers);
    clipMarkersBelowAxis(containerRef.current);

    const onChanged = () => clipMarkersBelowAxis(containerRef.current);
    timeline.on("changed", onChanged);

    return () => {
      timeline.off("timechanged", onTimeChanged);
      timeline.off("changed", onChanged);
      if (timelineRef.current) {
        timelineRef.current.destroy();
        timelineRef.current = null;
        markerIdsRef.current = [];
      }
    };
    // markerSnapshot captures markers identity for this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, markerSnapshot]);

  if (!items.length && !markers.length) {
    return (
      <section className="timeline" aria-labelledby={headingId}>
        <h3 id={headingId}>Timeline</h3>
        <p className="timeline-empty">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="timeline" aria-labelledby={headingId}>
      <h3 id={headingId}>Timeline</h3>
      <div
        ref={containerRef}
        className={`timeline-vis${markers.length ? " has-job-markers" : ""}`}
        role="img"
        aria-label="Interactive timeline of dated entries. Vertical markers show job start and end dates. Overlapping ranges are stacked."
      />
      <ul className="visually-hidden">
        {items.map((item) => (
          <li key={item.id}>
            {item.isPoint
              ? `${item.label}: ${dateToLabel(item.startKey)}`
              : `${item.label}: ${dateToLabel(item.startKey)} to ${dateToLabel(item.endKey)}`}
          </li>
        ))}
        {markers.map((marker) => (
          <li key={marker.id}>
            Marker: {marker.label} on {dateToLabel(marker.dateKey)}
          </li>
        ))}
      </ul>
    </section>
  );
}
