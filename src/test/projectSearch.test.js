import { describe, it, expect } from "vitest";
import { matchProjects, projectLabel } from "../lib/projectSearch";

const projects = [
  { id: 1, name: "MLO Heights Tower", short_name: "MLOH", project_code: "PRJ-000003", business_unit: "Residential" },
  { id: 2, name: "Bay Clubhouse", short_name: "BAYC", project_code: "PRJ-000007", business_unit: "Leisure" },
  { id: 3, name: "Manila Office Fit-out", short_name: null, project_code: "PRJ-000010", business_unit: "Commercial" },
];

describe("matchProjects", () => {
  it("returns every project for an empty query", () => {
    expect(matchProjects(projects, "  ")).toHaveLength(3);
  });

  it("matches the name, ignoring case", () => {
    expect(matchProjects(projects, "heights").map(p => p.id)).toEqual([1]);
  });

  it("matches short name, project code and business unit", () => {
    expect(matchProjects(projects, "bayc").map(p => p.id)).toEqual([2]);
    expect(matchProjects(projects, "000010").map(p => p.id)).toEqual([3]);
    expect(matchProjects(projects, "leisure").map(p => p.id)).toEqual([2]);
  });

  it("needs every typed word to match somewhere", () => {
    expect(matchProjects(projects, "manila commercial").map(p => p.id)).toEqual([3]);
    expect(matchProjects(projects, "manila leisure")).toEqual([]);
  });

  it("lists projects whose name starts with the query first", () => {
    const list = [{ id: 1, name: "Old Bay Road" }, { id: 2, name: "Bay Tower" }];
    expect(matchProjects(list, "bay").map(p => p.id)).toEqual([2, 1]);
  });
});

describe("projectLabel", () => {
  it("adds the short name when there is one", () => {
    expect(projectLabel(projects[0])).toBe("MLO Heights Tower · MLOH");
    expect(projectLabel(projects[2])).toBe("Manila Office Fit-out");
    expect(projectLabel(null)).toBe("");
  });
});
