import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
  The admin keeps Element Plus's own colours: the bright green, red, orange and blue it had before #17,
  with white labels on the fills. #17 redefined the five brand colours and every tint of them for the
  whole light theme, which turned every button, tag, alert, chart bar and chip into a dark shade. These
  tests pin the decision so it does not come back by accident.
*/

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const sources = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(vue|css|js)$/.test(entry.name)) sources.push(path);
  }
};
walk(resolve(root, "src"));
const relative = (file) => file.replace(root + "/", "");

describe("the admin keeps Element Plus's own colours", () => {
  it("has no palette stylesheet and does not import one", () => {
    expect(existsSync(resolve(root, "src/styles/accessible-palette.css"))).toBe(false);
    expect(read("src/main.js")).not.toMatch(/accessible-palette/);
  });

  it("redefines none of the brand colours or their tints anywhere", () => {
    const offenders = [];
    for (const file of sources) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (/^\s*--el-color-(primary|success|warning|danger|info)(-[\w-]+)?\s*:/.test(line)) {
            offenders.push(`${relative(file)}:${index + 1}: ${line.trim()}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });

  it("has no text or label tokens left over from the dark palette", () => {
    const offenders = [];
    for (const file of sources) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (/--admin-(text|on-fill)/.test(line)) offenders.push(`${relative(file)}:${index + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it("ships Element Plus's own bright colours", () => {
    const element = read("node_modules/element-plus/dist/index.css");
    const colour = (name) => element.match(new RegExp(`--el-color-${name}:(#[0-9a-fA-F]{6})`))[1];
    expect(colour("primary")).toBe("#409eff");
    expect(colour("success")).toBe("#67c23a");
    expect(colour("warning")).toBe("#e6a23c");
    expect(colour("danger")).toBe("#f56c6c");
    expect(colour("info")).toBe("#909399");
  });

  it("keeps the original secondary text grey", () => {
    const colors = read("src/styles/colors.css");
    const light = colors.slice(colors.indexOf(":root"), colors.indexOf("}", colors.indexOf(":root")));
    expect(light).toMatch(/--text-secondary:\s*#6c757d/);
  });

  it("keeps the original orange for quota percentages over 90%", () => {
    const page = read("src/pages/QuotaOverview.vue");
    expect(page).not.toContain("text-orange-700");
    expect(page).toContain("text-orange-600");
  });
});
