import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  normalizeTheme,
} from "../../src/shared/site-appearance.js";
import { MARKDOWN_STYLES } from "../../src/shared/markdown-styles.js";

describe("the README style a site offers by default", () => {
  it("is GitHub's unless said otherwise, and may be an id this build does not list", () => {
    expect(DEFAULT_THEME.markdown_style).toBe("github");
    expect(normalizeTheme({}).markdown_style).toBe("github");
    expect(normalizeTheme({ markdown_style: "vitepress" }).markdown_style).toBe(
      "vitepress",
    );
    // a newer server may name a style this build lacks: kept, not dropped
    expect(
      normalizeTheme({ markdown_style: "from-the-future" }).markdown_style,
    ).toBe("from-the-future");
  });

  it.each(["", "Has Spaces", "UPPER", "x".repeat(33), null, 7, "a/b"])(
    "refuses %j",
    (bad) => {
      expect(normalizeTheme({ markdown_style: bad })).toBeNull();
    },
  );

  it("lists GitHub first and every style once, as the web app's registry does", () => {
    expect(MARKDOWN_STYLES[0].id).toBe("github");
    const ids = MARKDOWN_STYLES.map((style) => style.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const style of MARKDOWN_STYLES)
      expect(style.id).toMatch(/^[a-z0-9-]{1,32}$/);
  });
});
