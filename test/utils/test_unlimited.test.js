import { describe, expect, it } from "vitest";

import {
  INFINITY,
  NO_LIMIT,
  UNLIMITED_BRACKET,
  UNLIMITED_HINT,
  UNLIMITED_LABEL,
  isUnlimitedInput,
} from "@/utils/unlimited";

describe("how no limit is written", () => {
  it('is the symbol, and its word is "No limit"', () => {
    expect(INFINITY).toBe("∞");
    expect(NO_LIMIT).toBe("No limit");
    expect(UNLIMITED_LABEL).toBe("∞ No limit");
    expect(UNLIMITED_BRACKET).toBe("∞ no limit");
  });

  it("tells an operator what to type, and that the words work too", () => {
    expect(UNLIMITED_HINT).toBe('"∞" ("no limit" and "unlimited" work too)');
  });
});

describe("isUnlimitedInput", () => {
  it.each([
    "∞",
    " ∞ ",
    "unlimited",
    "Unlimited",
    "UNLIMITED",
    "no limit",
    " No Limit ",
  ])("reads %j as no limit", (text) => {
    expect(isUnlimitedInput(text)).toBe(true);
  });

  it.each(["10GB", "", "   ", "infinity", "none", null, undefined, 0])(
    "does not read %j as no limit",
    (text) => {
      expect(isUnlimitedInput(text)).toBe(false);
    },
  );
});
