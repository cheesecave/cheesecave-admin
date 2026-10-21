import { describe, expect, it } from "vitest";
import {
  RECOMMENDED_COLORS,
  colorDistance,
  darkDepthOf,
  deriveTheme,
  hexToOklch,
  isHex,
  maxChroma,
  oklchToHex,
} from "../../src/shared/theme-derive.js";
import { contrastRatio } from "../../src/shared/site-theme.js";

describe("theme derivation", () => {
  it("accepts only six-digit hex colors", () => {
    expect(isHex("#2563eb")).toBe(true);
    expect(isHex("#2563EB")).toBe(true);
    for (const bad of [
      "2563eb",
      "#256",
      "#2563e",
      "#2563ebf",
      "#25g3eb",
      "",
      null,
      undefined,
      5,
    ])
      expect(isHex(bad)).toBe(false);
  });

  it("converts to OKLCH and back without drifting", () => {
    expect(hexToOklch("#ffffff")).toMatchObject({
      L: expect.closeTo(1, 3),
      C: expect.closeTo(0, 3),
    });
    expect(hexToOklch("#000000").L).toBeCloseTo(0, 3);
    const red = hexToOklch("#dc2626");
    expect(red.h).toBeGreaterThan(20);
    expect(red.h).toBeLessThan(35);
    for (const [, hex] of RECOMMENDED_COLORS)
      expect(
        colorDistance(oklchToHex(...Object.values(hexToOklch(hex))), hex),
      ).toBeLessThan(0.004);
  });

  it("keeps hues positive and clamps chroma to what the screen can show", () => {
    expect(hexToOklch("#2563eb").h).toBeGreaterThan(0);
    expect(hexToOklch("#e11d48").h).toBeGreaterThan(0);
    expect(maxChroma(0.55, 90)).toBeLessThan(maxChroma(0.55, 300));
    expect(isHex(oklchToHex(0.9, 0.4, 140))).toBe(true);
    expect(
      colorDistance(
        oklchToHex(0.9, 0.4, 140),
        oklchToHex(0.9, maxChroma(0.9, 140), 140),
      ),
    ).toBeLessThan(0.002);
  });

  it("measures how different two colors look", () => {
    expect(colorDistance("#123456", "#123456")).toBe(0);
    expect(colorDistance("#000000", "#ffffff")).toBeGreaterThan(0.9);
  });

  it("offers sixteen distinct recommended colors, each a valid hex with a name", () => {
    expect(RECOMMENDED_COLORS).toHaveLength(16);
    expect(new Set(RECOMMENDED_COLORS.map(([name]) => name)).size).toBe(16);
    expect(new Set(RECOMMENDED_COLORS.map(([, hex]) => hex)).size).toBe(16);
    for (const [name, hex] of RECOMMENDED_COLORS) {
      expect(name).toMatch(/^[A-Z]/);
      expect(isHex(hex)).toBe(true);
    }
  });

  it("derives the six site colors from one main color", () => {
    const theme = deriveTheme("#2563eb", 0);
    expect(Object.keys(theme).sort()).toEqual([
      "background_dark",
      "background_light",
      "card_dark",
      "card_light",
      "primary_dark",
      "primary_light",
    ]);
    expect(theme.primary_light).toBe("#2563eb");
    expect(theme.card_light).toBe("#ffffff");
    expect(Object.values(theme).every(isHex)).toBe(true);
    expect(hexToOklch(theme.background_light).L).toBeCloseTo(0.96, 1);
    expect(hexToOklch(theme.primary_dark).L).toBeGreaterThanOrEqual(0.67);
    expect(hexToOklch(theme.card_dark).L).toBeGreaterThan(
      hexToOklch(theme.background_dark).L,
    );
  });

  it("keeps the main color's hue in the dark primary, and lifts only dark colors that are too dark", () => {
    const pale = deriveTheme("#facc15", 0);
    expect(hexToOklch(pale.primary_dark).L).toBeCloseTo(
      hexToOklch("#facc15").L,
      2,
    );
    const dark = deriveTheme("#1e3a8a", 0);
    expect(hexToOklch(dark.primary_dark).L).toBeGreaterThan(
      hexToOklch("#1e3a8a").L + 0.2,
    );
    expect(
      Math.abs(hexToOklch(dark.primary_dark).h - hexToOklch("#1e3a8a").h),
    ).toBeLessThan(3);
  });

  it("makes the dark page deeper as the depth grows", () => {
    const soft = hexToOklch(deriveTheme("#7c3aed", 0).background_dark).L;
    const mid = hexToOklch(deriveTheme("#7c3aed", 0.5).background_dark).L;
    const deep = hexToOklch(deriveTheme("#7c3aed", 1).background_dark).L;
    expect(soft).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(deep);
    expect(soft).toBeCloseTo(0.23, 1);
    expect(deep).toBeCloseTo(0.16, 1);
  });

  it("recovers the depth a saved theme was made with, within the slider's range", () => {
    for (const depth of [0, 0.25, 0.5, 1])
      expect(
        darkDepthOf(deriveTheme("#16a34a", depth).background_dark),
      ).toBeCloseTo(depth * 100, -1);
    expect(darkDepthOf("#ffffff")).toBe(0);
    expect(darkDepthOf("#000000")).toBe(100);
  });

  it("derives link-readable pairs for every recommended color in both modes", () => {
    for (const [, hex] of RECOMMENDED_COLORS) {
      const theme = deriveTheme(hex, 0.5);
      expect(
        contrastRatio(theme.primary_dark, theme.card_dark),
      ).toBeGreaterThan(3);
    }
  });
});
