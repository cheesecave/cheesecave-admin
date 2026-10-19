import { readdirSync, readFileSync } from "node:fs";
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

const TYPES = ["primary", "success", "warning", "danger", "info"];

// Element Plus's own light palette, read from the stylesheet the app ships.
const element = readFileSync(
  resolve(process.cwd(), "node_modules/element-plus/dist/index.css"),
  "utf8",
);
// Element Plus writes the base colours as hex and the tints as rgb(r,g,b); both come back as #rrggbb.
const elementColour = (name) => {
  const value = element.match(new RegExp(`--el-color-${name}:(#[0-9a-fA-F]{6}|rgb\\([^)]*\\))`))[1];
  if (value.startsWith("#")) return value;
  return (
    "#" +
    value
      .match(/\d+/g)
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")
  );
};

describe("accessible light palette", () => {
  const css = read("accessible-palette.css");
  const light = variables(css, "html:not(.dark)");

  it("keeps Element Plus's own bright brand colours and their tints", () => {
    const block = css.slice(
      css.indexOf("html:not(.dark)"),
      css.indexOf("}", css.indexOf("html:not(.dark)")),
    );
    expect(block).not.toMatch(/--el-color-(primary|success|warning|danger|info)/);
    // and the defaults it keeps are the bright ones the admin always had
    expect(elementColour("success")).toBe("#67c23a");
    expect(elementColour("danger")).toBe("#f56c6c");
  });

  it("leaves the dark theme's own colours alone", () => {
    const dark = css.slice(css.indexOf("html.dark"));
    expect(dark).not.toMatch(
      /--el-color-(primary|success|warning|danger|info)\s*:/,
    );
  });

  it.each(TYPES)(
    "%s: dark text on the bright fill, on its hover and on its pressed state",
    (type) => {
      const text = light["--admin-on-fill"];
      expect(text).toBeDefined();
      const fill = elementColour(type);
      const hover = elementColour(`${type}-light-3`);
      expect(contrast(text, fill), "button text on the fill").toBeGreaterThanOrEqual(AA);
      expect(contrast(text, hover), "button text on hover").toBeGreaterThanOrEqual(AA);
      // the pressed state is set back to the fill (Element's dark-2 would be too dark for dark text)
      const rule = new RegExp(
        `html:not\\(\\.dark\\) \\.el-button--${type}:not\\(\\.is-plain\\):not\\(\\.is-text\\):not\\(\\.is-link\\)\\s*\\{([^}]*)\\}`,
      );
      const body = css.match(rule)?.[1] ?? "";
      expect(body).toContain("--el-button-text-color: var(--admin-on-fill)");
      expect(body).toContain("--el-button-hover-text-color: var(--admin-on-fill)");
      expect(body).toContain(`--el-button-active-bg-color: var(--el-color-${type})`);
      expect(body).toContain(`--el-button-active-border-color: var(--el-color-${type})`);
    },
  );

  it.each(TYPES)(
    "%s: coloured text reads on white, on the page and on its own tint",
    (type) => {
      const text = light[`--admin-text-${type}`];
      expect(text, "text colour").toBeDefined();
      const tint = elementColour(`${type}-light-9`);
      expect(contrast(text, WHITE), "on white").toBeGreaterThanOrEqual(AA);
      expect(contrast(text, PAGE), "on the page").toBeGreaterThanOrEqual(AA);
      expect(contrast(text, tint), "on the tint").toBeGreaterThanOrEqual(AA);
      // the task page's chips and pills tint the page with 12% of the colour (color-mix in srgb)
      const base = elementColour(type);
      const chip = (page) =>
        "#" +
        rgb(page)
          .map((c, i) => Math.round(c * 0.88 + rgb(base)[i] * 0.12).toString(16).padStart(2, "0"))
          .join("");
      expect(contrast(text, chip(WHITE)), "on a chip over white").toBeGreaterThanOrEqual(AA);
      expect(contrast(text, chip(PAGE)), "on a chip over the page").toBeGreaterThanOrEqual(AA);
    },
  );

  it.each(TYPES)(
    "%s: tags, alerts, messages, links, plain and text buttons, badges and dark tags use it",
    (type) => {
      const own = `var(--admin-text-${type})`;
      const rule = (selector) => {
        const at = css.indexOf(selector);
        expect(at, selector).toBeGreaterThanOrEqual(0);
        return css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
      };
      expect(rule(`html:not(.dark) .el-tag--${type}.el-tag--light`)).toContain(`--el-tag-text-color: ${own}`);
      expect(rule(`html:not(.dark) .el-tag--${type}.el-tag--plain`)).toContain(`--el-tag-text-color: ${own}`);
      expect(rule(`html:not(.dark) .el-alert--${type}.is-light {`)).toContain(`color: ${own}`);
      expect(rule(`html:not(.dark) .el-alert--${type}.is-light .el-alert__description`)).toContain(`color: ${own}`);
      expect(rule(`html:not(.dark) .el-message--${type} {`)).toContain(`--el-message-text-color: ${own}`);
      expect(rule(`html:not(.dark) .el-link--${type} {`)).toContain(`--el-link-text-color: ${own}`);
      expect(rule(`html:not(.dark) .el-link--${type} {`)).toContain(`--el-link-hover-text-color: ${own}`);
      const plain = rule(`html:not(.dark) .el-button--${type}.is-plain`);
      expect(plain).toContain(`--el-button-text-color: ${own}`);
      expect(plain).toContain("--el-button-hover-text-color: var(--admin-on-fill)");
      expect(plain).toContain("--el-button-active-text-color: var(--admin-on-fill)");
      const flat = rule(`html:not(.dark) .el-button--${type}.is-text`);
      expect(flat).toContain(`--el-button-text-color: ${own}`);
      expect(flat).toContain(`--el-button-hover-text-color: ${own}`);
      expect(rule(`html:not(.dark) .el-badge__content--${type}`)).toContain("color: var(--admin-on-fill)");
      expect(rule(`html:not(.dark) .el-tag--dark.el-tag--${type}`)).toContain("--el-tag-text-color: var(--admin-on-fill)");
    },
  );

  it("puts dark text on the checked radio button and keeps secondary text readable", () => {
    expect(css).toMatch(/html:not\(\.dark\) \.el-radio-button\s*\{[^}]*--el-radio-button-checked-text-color: var\(--admin-on-fill\)/);
    const secondary = light["--el-text-color-secondary"];
    expect(contrast(secondary, WHITE)).toBeGreaterThanOrEqual(AA);
    expect(contrast(secondary, PAGE)).toBeGreaterThanOrEqual(AA);
  });

  it("keeps the admin's own secondary text readable on the page", () => {
    const own = variables(read("colors.css"), ":root");
    expect(contrast(own["--text-secondary"], PAGE)).toBeGreaterThanOrEqual(AA);
    expect(contrast(own["--text-secondary"], WHITE)).toBeGreaterThanOrEqual(AA);
  });

  it("gives the dark theme the bright colours as its text colours", () => {
    const css2 = css.slice(css.indexOf("html.dark {"));
    for (const type of TYPES) {
      expect(css2).toContain(`--admin-text-${type}: var(--el-color-${type})`);
    }
  });
});

describe("components take their coloured text from the text tokens", () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(vue|css)$/.test(entry.name)) files.push(path);
    }
  };
  walk(resolve(process.cwd(), "src"));

  it("no component sets text to a raw brand colour (it reads 2 to 3:1 on white)", () => {
    const offenders = [];
    for (const file of files) {
      if (file.endsWith("accessible-palette.css")) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (
            /^\s*color:\s*var\(--(el-color-(primary|success|warning|danger|info)|pill)(?![-\w])/.test(line)
          ) {
            offenders.push(`${file.replace(process.cwd() + "/", "")}:${index + 1}: ${line.trim()}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });

  it("nor through a custom property that holds one (--chip-color, --status-color, --pill)", () => {
    const offenders = [];
    for (const file of files) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (/^\s*color:\s*var\(--(chip-color|status-color|pill)\)/.test(line)) {
            offenders.push(`${file.replace(process.cwd() + "/", "")}:${index + 1}: ${line.trim()}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });

  it("the Overview's own text does not use the admin's bright state tokens either", () => {
    const offenders = [];
    for (const file of files.filter((f) => f.includes("/components/overview/"))) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (/^\s*color:\s*var\(--color-(info|error|success|warning)\b/.test(line)) {
            offenders.push(`${file.replace(process.cwd() + "/", "")}:${index + 1}: ${line.trim()}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });

  it("switch labels that are on use the text colour, not the bright primary", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/accessible-palette.css"), "utf8");
    expect(css).toMatch(/html:not\(\.dark\) \.el-switch__label\.is-active\s*\{[^}]*color: var\(--admin-text-primary\)/);
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
