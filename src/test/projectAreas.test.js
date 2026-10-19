import { describe, it, expect } from "vitest";
import {
  defaultAreas, setTowerCount, towerCount, addArea, hasAreaName, activeAreas,
  totalUnits, areaSummary, areaNames, switchType,
} from "../lib/projectAreas";

const names = (areas) => areas.map(a => a.name);

describe("defaultAreas", () => {
  it("gives a condominium its towers and the standard areas", () => {
    const areas = defaultAreas("Condominium", 2);
    expect(names(areas)).toEqual([
      "Tower 1", "Tower 2", "Parking Building", "Site Development", "Amenities",
      "Add-Ons", "Professional Fees", "Pre-Engineering",
    ]);
    expect(areas.filter(a => a.kind === "tower")).toHaveLength(2);
  });

  it("gives housing its unit types and the standard areas", () => {
    const areas = defaultAreas("Housing");
    expect(names(areas.filter(a => a.kind === "unit_type"))).toEqual(["TH End", "TH Mid", "SA"]);
    expect(names(areas.filter(a => a.kind === "area"))).toEqual([
      "Site Development", "Amenities", "Temporary Sales Office", "Gate and Guardhouse",
      "Model Unit ID", "Add-on Solar", "Professional Fees", "Pre-Engineering",
    ]);
  });

  it("starts the add-ons unticked and everything else ticked", () => {
    const off = (type) => names(defaultAreas(type).filter(a => !a.active));
    expect(off("Condominium")).toEqual(["Add-Ons"]);
    expect(off("Housing")).toEqual(["Add-on Solar"]);
  });

  it("gives every area a unique, stable id", () => {
    const areas = defaultAreas("Condominium", 3);
    expect(new Set(areas.map(a => a.id)).size).toBe(areas.length);
    expect(areas[0].id).toBe("tower-1");
    expect(defaultAreas("Housing").find(a => a.name === "Site Development").id)
      .toBe(defaultAreas("Condominium").find(a => a.name === "Site Development").id);
  });
});

describe("setTowerCount", () => {
  it("adds towers after the existing ones, before the other areas", () => {
    const areas = setTowerCount(defaultAreas("Condominium", 1), 3);
    expect(names(areas).slice(0, 4)).toEqual(["Tower 1", "Tower 2", "Tower 3", "Parking Building"]);
    expect(towerCount(areas)).toBe(3);
  });

  it("keeps units and renamed towers when growing", () => {
    let areas = defaultAreas("Condominium", 1);
    areas = areas.map(a => a.id === "tower-1" ? { ...a, name: "Tower A", units: 412 } : a);
    areas = setTowerCount(areas, 2);
    expect(areas[0]).toMatchObject({ name: "Tower A", units: 412, active: true });
  });

  it("unticks extra towers instead of deleting them, so old PRs keep their names", () => {
    const areas = setTowerCount(defaultAreas("Condominium", 3), 1);
    expect(towerCount(areas)).toBe(1);
    expect(areas.find(a => a.id === "tower-3")).toMatchObject({ name: "Tower 3", active: false });
  });

  it("ticks a tower again when the count grows back", () => {
    const areas = setTowerCount(setTowerCount(defaultAreas("Condominium", 3), 1), 2);
    expect(areas.find(a => a.id === "tower-2").active).toBe(true);
    expect(areas.find(a => a.id === "tower-3").active).toBe(false);
  });
});

describe("addArea", () => {
  it("adds a ticked area of the given kind with a new id", () => {
    const before = defaultAreas("Housing");
    const after = addArea(before, "  Duplex  ", "unit_type");
    const added = after.find(a => a.name === "Duplex");
    expect(added).toMatchObject({ kind: "unit_type", active: true, units: null });
    expect(before.some(a => a.id === added.id)).toBe(false);
  });

  it("puts a new unit type after the other unit types", () => {
    const after = addArea(defaultAreas("Housing"), "Duplex", "unit_type");
    expect(names(after).slice(0, 4)).toEqual(["TH End", "TH Mid", "SA", "Duplex"]);
  });

  it("spots names already in the list, ignoring case and spaces", () => {
    expect(hasAreaName(defaultAreas("Condominium"), " amenities ")).toBe(true);
    expect(hasAreaName(defaultAreas("Condominium"), "Clubhouse")).toBe(false);
  });
});

describe("units and summary", () => {
  const areas = defaultAreas("Condominium", 3).map(a =>
    a.id === "tower-1" ? { ...a, units: 412 } : a.id === "tower-2" ? { ...a, units: 380 } : a.id === "tower-3" ? { ...a, units: 395, active: false } : a);

  it("counts units on ticked areas only", () => {
    expect(totalUnits(areas)).toBe(792);
  });

  it("summarises a condominium", () => {
    expect(areaSummary("Condominium", areas)).toBe("2 towers · 5 other areas · 792 units");
  });

  it("summarises housing and leaves out units when none are entered", () => {
    expect(areaSummary("Housing", defaultAreas("Housing"))).toBe("3 unit types · 7 other areas");
  });

  it("is empty when nothing is set up", () => {
    expect(areaSummary(null, null)).toBe("");
    expect(activeAreas(undefined)).toEqual([]);
  });
});

describe("areaNames", () => {
  it("turns ids into names, keeping unticked ones and skipping unknown ids", () => {
    const areas = setTowerCount(defaultAreas("Condominium", 2), 1);
    expect(areaNames(areas, ["tower-2", "parking-building", "nope"])).toEqual(["Tower 2", "Parking Building"]);
    expect(areaNames(null, ["tower-1"])).toEqual([]);
  });
});

describe("switchType", () => {
  it("brings in the new type's list and keeps ticks and units for shared areas", () => {
    const condo = defaultAreas("Condominium", 1).map(a => a.name === "Amenities" ? { ...a, active: false } : a);
    const housing = switchType(condo, "Housing");
    expect(housing.find(a => a.name === "Amenities").active).toBe(false);
    expect(housing.find(a => a.name === "TH End").active).toBe(true);
  });

  it("keeps areas that only the old type had, unticked", () => {
    const housing = switchType(defaultAreas("Condominium", 1), "Housing");
    expect(housing.find(a => a.id === "tower-1")).toMatchObject({ active: false });
    expect(housing.find(a => a.name === "Parking Building")).toMatchObject({ active: false });
  });
});
