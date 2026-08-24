import { describe, expect, it } from "vitest";
import {
  collectEmploymentDateIssues,
  collectOrderIssues,
  formatDurationPlain,
  formatIssueTooltip,
  mergeIssueMaps,
  withIndex,
} from "../src/utils.js";

describe("formatDurationPlain", () => {
  it("returns empty string without a start date", () => {
    expect(formatDurationPlain("", "01-01-2020")).toBe("");
  });

  it("describes short spans in weeks", () => {
    expect(formatDurationPlain("01-01-2020", "01-08-2020")).toBe("1 week");
    expect(formatDurationPlain("01-01-2020", "01-29-2020")).toBe("4 weeks");
    expect(formatDurationPlain("01-01-2020", "03-12-2020")).toBe("10 weeks");
  });

  it("switches to months above 10 weeks", () => {
    expect(formatDurationPlain("01-01-2020", "03-19-2020")).toBe("3 months");
    expect(formatDurationPlain("01-01-2020", "01-01-2021")).toBe("12 months");
  });

  it("uses today when ongoing", () => {
    const label = formatDurationPlain("01-01-2020", null, { ongoing: true });
    expect(label).toMatch(/^\d+ months$/);
  });
});

describe("collectOrderIssues", () => {
  const byStart = (item) => {
    if (!item.start) return null;
    const [m, d, y] = item.start.split("-").map(Number);
    return y * 10000 + m * 100 + d;
  };

  it("returns nothing when display order matches newest-first dates", () => {
    const rows = withIndex([
      { order: 0, start: "01-01-2024" },
      { order: 1, start: "01-01-2022" },
      { order: 2, start: "01-01-2020" },
    ]);
    expect(collectOrderIssues(rows, byStart).size).toBe(0);
  });

  it("highlights only the adjacent dated inversion", () => {
    const rows = withIndex([
      { order: 0, start: "01-01-2020" },
      { order: 1, start: "01-01-2018" },
      { order: 2, start: "01-01-2024" },
      { order: 3, start: "01-01-2016" },
    ]);
    const issues = collectOrderIssues(rows, byStart);
    expect([...issues.keys()]).toEqual([2]);
    expect(issues.get(2)[0]).toMatch(/Newer than the dated entry above/);
  });

  it("highlights only an undated row in the middle, not everything below", () => {
    const rows = withIndex([
      { order: 0, start: "01-01-2026" },
      { order: 1, start: null },
      { order: 2, start: "01-01-2024" },
      { order: 3, start: "01-01-2022" },
    ]);
    const issues = collectOrderIssues(rows, byStart);
    expect([...issues.keys()]).toEqual([1]);
    expect(issues.get(1)[0]).toMatch(/Missing a date/);
  });

  it("allows undated rows at the end", () => {
    const rows = withIndex([
      { order: 0, start: "01-01-2024" },
      { order: 1, start: "01-01-2022" },
      { order: 2, start: null },
    ]);
    expect(collectOrderIssues(rows, byStart).size).toBe(0);
  });
});

describe("collectEmploymentDateIssues", () => {
  const experience = [
    {
      company: "Highspot",
      start_date: "03-01-2022",
      current: true,
    },
    {
      company: "Wrench",
      start_date: "11-01-2019",
      end_date: "03-01-2022",
      current: false,
    },
  ];

  it("returns no issues when project falls inside employment", () => {
    expect(
      collectEmploymentDateIssues(
        {
          company: "Highspot",
          start_date: "04-01-2022",
          end_date: "01-31-2023",
        },
        experience,
      ),
    ).toEqual([]);
  });

  it("flags project start before employment start", () => {
    const issues = collectEmploymentDateIssues(
      {
        company: "Highspot",
        start_date: "01-01-2022",
        end_date: "01-31-2023",
      },
      experience,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/before Highspot employment start/);
  });

  it("flags project end after employment end", () => {
    const issues = collectEmploymentDateIssues(
      {
        company: "Wrench",
        start_date: "01-01-2020",
        end_date: "06-01-2022",
      },
      experience,
    );
    expect(issues.some((msg) => /after Wrench employment end/.test(msg))).toBe(
      true,
    );
  });

  it("flags missing company experience", () => {
    const issues = collectEmploymentDateIssues(
      { company: "Acme", start_date: "01-01-2020", end_date: "01-01-2021" },
      experience,
    );
    expect(issues[0]).toMatch(/No experience entry found for company “Acme”/);
  });
});

describe("formatIssueTooltip", () => {
  it("formats one or more bulleted reasons", () => {
    expect(formatIssueTooltip(["Only one"])).toBe("• Only one");
    expect(formatIssueTooltip(["First", "Second"])).toBe("• First\n• Second");
  });

  it("merges issue maps", () => {
    const merged = mergeIssueMaps(
      new Map([[0, ["order"]]]),
      new Map([
        [0, ["employment"]],
        [1, ["other"]],
      ]),
    );
    expect(merged.get(0)).toEqual(["order", "employment"]);
    expect(merged.get(1)).toEqual(["other"]);
  });
});
