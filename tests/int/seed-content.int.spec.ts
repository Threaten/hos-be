import { describe, expect, it } from "vitest";
import { fillMissing } from "../../src/seed/fillMissing";

describe("seed content backfill", () => {
  it("fills missing fields while preserving edited names, closure status, and false settings", () => {
    expect(
      fillMissing(
        {
          name: "Red Space",
          status: "closed",
          enabled: false,
          phone: "",
          location: { latitude: 12 },
        },
        {
          name: "Red Bistro",
          status: "open",
          enabled: true,
          phone: "0000000000",
          location: { latitude: 0, longitude: 0 },
        },
      ),
    ).toEqual({
      name: "Red Space",
      status: "closed",
      enabled: false,
      phone: "0000000000",
      location: { latitude: 12, longitude: 0 },
    });
  });

  it("extends arrays without duplicating stored entries that have Payload row IDs", () => {
    const existing = [{ id: "row-1", quote: "First" }];
    const defaults = [
      { quote: "First" },
      { quote: "Second" },
      { quote: "Third" },
    ];
    const result = fillMissing(existing, defaults);
    expect(result).toEqual([...existing, ...defaults.slice(1)]);
    expect(fillMissing(result, defaults)).toEqual(result);
  });

  it("does not truncate existing arrays", () => {
    expect(fillMissing([1, 2, 3], [1, 2])).toEqual([1, 2, 3]);
  });
});

it("preserves an edited opening-hours description", () => {
  expect(fillMissing({ openingHours: "10:00–23:00" }, { openingHours: "11:00–22:00" }))
    .toEqual({ openingHours: "10:00–23:00" });
});
