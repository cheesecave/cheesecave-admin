import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path) =>
  readFileSync(resolve(process.cwd(), "src/styles", path), "utf8");

const rgb = (hex) =>
  [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
const channel = (value) => {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Every `--name: #rrggbb;` declaration inside the first block that starts with `selector`. */
function variables(css, selector) {
  const start = css.indexOf(selector);
  expect(start, `block ${selector}`).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [
      m[1],
      m[2],
    ]),
  );
}

const AA = 4.5;
const WHITE = "#ffffff";
const PAGE = "#f5f5f5"; // --bg-base of the admin pages

describe("accessible light palette", () => {
  const light = variables(read("accessible-palette.css"), "html:not(.dark)");

  it("leaves the dark theme's own colours alone", () => {
    const css = read("accessible-palette.css");
    const dark = css.slice(css.indexOf("html.dark"));
    expect(dark).not.toMatch(
      /--el-color-(primary|success|warning|danger|info)\s*:/,
    );
  });

  it.each(["primary", "success", "warning", "danger", "info"])(
    "%s reads on white, as a button, as text, and on its tinted background",
    (type) => {
      const base = light[`--el-color-${type}`];
      const tint = light[`--el-color-${type}-light-9`];
      const hover = light[`--el-color-${type}-light-3`];
      expect(base, "base colour").toBeDefined();
      expect(
        contrast(WHITE, base),
        "white text on the filled button",
      ).toBeGreaterThanOrEqual(AA);
      expect(
        contrast(base, WHITE),
        "coloured text on white",
      ).toBeGreaterThanOrEqual(AA);
      expect(
        contrast(base, PAGE),
        "coloured text on the page",
      ).toBeGreaterThanOrEqual(AA);
      expect(
        contrast(base, tint),
        "tag text on its tint",
      ).toBeGreaterThanOrEqual(AA);
      expect(
        contrast(WHITE, hover),
        "white text on the hovered button",
      ).toBeGreaterThanOrEqual(AA);
    },
  );

  it("keeps secondary text readable on white and on the page", () => {
    const secondary = light["--el-text-color-secondary"];
    expect(contrast(secondary, WHITE)).toBeGreaterThanOrEqual(AA);
    expect(contrast(secondary, PAGE)).toBeGreaterThanOrEqual(AA);
  });

  it("keeps the admin's own secondary text readable on the page", () => {
    const own = variables(read("colors.css"), ":root");
    expect(contrast(own["--text-secondary"], PAGE)).toBeGreaterThanOrEqual(AA);
    expect(contrast(own["--text-secondary"], WHITE)).toBeGreaterThanOrEqual(AA);
  });
});

describe("accessible dark theme", () => {
  const css = read("accessible-palette.css");
  const dark = variables(css, "html.dark {");
  // Element Plus's own dark palette: bright fills, with their hover colour (dark-2).
  const chalk = readFileSync(
    resolve(
      process.cwd(),
      "node_modules/element-plus/theme-chalk/dark/css-vars.css",
    ),
    "utf8",
  );
  const rgbToHex = (text) =>
    "#" +
    text
      .match(/\d+/g)
      .slice(0, 3)
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("");

  it("puts dark text on the bright dark-theme fills of buttons and dark tags", () => {
    const text = dark["--admin-on-fill"];
    expect(text).toBeDefined();
    for (const type of ["primary", "success", "warning", "danger", "info"]) {
      const fill = chalk.match(
        new RegExp(`--el-color-${type}:(#[0-9a-fA-F]{6})`),
      )[1];
      const hover = rgbToHex(
        chalk.match(
          new RegExp(`--el-color-${type}-dark-2:(rgb\\([^)]*\\))`),
        )[1],
      );
      expect(contrast(text, fill), `${type} fill`).toBeGreaterThanOrEqual(AA);
      expect(contrast(text, hover), `${type} hover`).toBeGreaterThanOrEqual(AA);
      expect(css).toContain(`html.dark .el-button--${type}`);
    }
    expect(css).toContain("html.dark .el-tag--dark");
    expect(css).toContain("html.dark .el-radio-button");
  });
});
