import { describe, expect, it } from "vitest";

import { formatAge } from "@/utils/relative-time";

const NOW = Date.parse("2026-10-19T12:00:00Z");
const ago = (seconds) => new Date(NOW - seconds * 1000).toISOString();

describe("formatAge", () => {
  it.each([
    [0, "just now"],
    [44, "just now"],
    [45, "1 min ago"],
    [12 * 60, "12 min ago"],
    [59 * 60, "59 min ago"],
    [60 * 60, "1 h ago"],
    [23 * 3600, "23 h ago"],
    [24 * 3600, "yesterday"],
    [47 * 3600, "yesterday"],
    [48 * 3600, "2 d ago"],
    [10 * 86400, "10 d ago"],
  ])("%s seconds ago reads %s", (seconds, text) => {
    expect(formatAge(ago(seconds), NOW)).toBe(text);
  });

  it("treats a timestamp slightly in the future (clock skew) as just now", () => {
    expect(formatAge(ago(-30), NOW)).toBe("just now");
  });

  it("returns an empty string for a missing or invalid timestamp", () => {
    expect(formatAge(null, NOW)).toBe("");
    expect(formatAge("not a date", NOW)).toBe("");
  });

  it("uses the current time when none is given", () => {
    expect(formatAge(new Date().toISOString())).toBe("just now");
  });
});
