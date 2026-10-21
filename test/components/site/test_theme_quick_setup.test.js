import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { ElementPlusStubs } from "../../helpers/vue";
import ThemeQuickSetup from "@/components/site/ThemeQuickSetup.vue";
import { DEFAULT_THEME } from "@/shared/site-appearance.js";
import { deriveTheme, hexToOklch, maxChroma } from "@/shared/theme-derive.js";

const SAVED = { ...DEFAULT_THEME, ...deriveTheme("#2563eb", 0) };
const mountDialog = (props = {}) =>
  mount(ThemeQuickSetup, {
    props: { modelValue: true, theme: SAVED, ...props },
    global: { stubs: ElementPlusStubs },
  });
const swatch = (wrapper, name) =>
  wrapper.get(`[data-testid="qs-swatch-${name}"]`);
const out = (wrapper, id) =>
  wrapper.get(`[data-testid="qs-${id}-value"]`).text();
const previewStyle = (wrapper, mode) =>
  wrapper.get(`[data-testid="qs-preview-${mode}"]`).attributes("style");
const button = (wrapper, text) =>
  wrapper.findAll("button").find((item) => item.text() === text);

describe("ThemeQuickSetup", () => {
  it("renders nothing while closed", () => {
    expect(mountDialog({ modelValue: false }).find("#qs-hex").exists()).toBe(
      false,
    );
  });

  it("starts from the colors on the page: main color, matching swatch, dark depth", () => {
    const wrapper = mountDialog({
      theme: { ...SAVED, ...deriveTheme("#16a34a", 1) },
    });
    expect(wrapper.get("#qs-hex").element.value).toBe("#16a34a");
    expect(swatch(wrapper, "Green").attributes("aria-pressed")).toBe("true");
    expect(swatch(wrapper, "Blue").attributes("aria-pressed")).toBe("false");
    expect(wrapper.get("#qs-depth").element.value).toBe("100");
    expect(out(wrapper, "depth")).toBe("100%");
  });

  it("falls back to the default colors when the page holds something that is not a color", () => {
    const wrapper = mountDialog({
      theme: { ...SAVED, primary_light: "oops", background_dark: "#12" },
    });
    expect(wrapper.get("#qs-hex").element.value).toBe(
      DEFAULT_THEME.primary_light,
    );
    expect(wrapper.get("#qs-depth").element.value).toBe("0");
  });

  it("opens on the colors the form holds when it is opened, not when the page was loaded", async () => {
    const wrapper = mountDialog({ modelValue: false });
    await wrapper.setProps({
      theme: { ...SAVED, ...deriveTheme("#16a34a", 0) },
    });
    await wrapper.setProps({ modelValue: true });
    expect(wrapper.get("#qs-hex").element.value).toBe("#16a34a");
  });

  it("shows sixteen recommended colors and marks none when the color is not one of them", () => {
    const wrapper = mountDialog({
      theme: { ...SAVED, primary_light: "#94621f" },
    });
    expect(wrapper.findAll('[data-testid^="qs-swatch-"]')).toHaveLength(16);
    expect(wrapper.findAll('[aria-pressed="true"]')).toHaveLength(0);
  });

  it("chooses a recommended color: hex, bars, swatch and both demos follow", async () => {
    const wrapper = mountDialog();
    await swatch(wrapper, "Orange").trigger("click");
    expect(wrapper.get("#qs-hex").element.value).toBe("#ea580c");
    expect(swatch(wrapper, "Orange").attributes("aria-pressed")).toBe("true");
    expect(swatch(wrapper, "Blue").attributes("aria-pressed")).toBe("false");
    expect(out(wrapper, "hue")).toMatch(/^4\d°$/);
    expect(previewStyle(wrapper, "light")).toContain(
      "--preview-primary: #ea580c",
    );
    expect(previewStyle(wrapper, "dark")).toContain(
      `--preview-primary: ${deriveTheme("#ea580c", 0).primary_dark}`,
    );
  });

  it("moves the main color along each bar and shows the value", async () => {
    const wrapper = mountDialog();
    await swatch(wrapper, "Red").trigger("click");
    const before = hexToOklch(wrapper.get("#qs-hex").element.value);
    await wrapper.get("#qs-hue").setValue("150");
    let now = hexToOklch(wrapper.get("#qs-hex").element.value);
    expect(Math.abs(now.h - 150)).toBeLessThan(4);
    expect(out(wrapper, "hue")).toBe("150°");
    await wrapper.get("#qs-lightness").setValue("80");
    now = hexToOklch(wrapper.get("#qs-hex").element.value);
    expect(now.L).toBeCloseTo(0.8, 1);
    expect(out(wrapper, "lightness")).toBe("80");
    await wrapper.get("#qs-vividness").setValue("20");
    const vivid = hexToOklch(wrapper.get("#qs-hex").element.value);
    expect(vivid.C).toBeLessThan(maxChroma(vivid.L, vivid.h) * 0.3);
    expect(out(wrapper, "vividness")).toMatch(/^(1\d|2\d)%$/);
    expect(before.C).toBeGreaterThan(vivid.C);
  });

  it("styles each bar's track with the colors it would pass through", async () => {
    const wrapper = mountDialog();
    for (const id of ["hue", "vividness", "lightness", "depth"])
      expect(wrapper.get(`#qs-${id}`).attributes("style")).toContain(
        "linear-gradient",
      );
    await swatch(wrapper, "Teal").trigger("click");
    expect(wrapper.get("#qs-hue").attributes("style")).toContain(
      "--cur: #0d9488",
    );
  });

  it("takes a typed hex exactly, and ignores one that is not finished", async () => {
    const wrapper = mountDialog();
    await wrapper.get("#qs-hex").setValue("#12");
    expect(wrapper.get("#qs-hex").attributes("aria-invalid")).toBe("true");
    expect(previewStyle(wrapper, "light")).toContain(
      "--preview-primary: #2563eb",
    );
    await wrapper.get("#qs-hex").setValue("#E8590C");
    expect(wrapper.get("#qs-hex").attributes("aria-invalid")).toBe("false");
    expect(previewStyle(wrapper, "light")).toContain(
      "--preview-primary: #e8590c",
    );
    await wrapper.get("#qs-apply").trigger("click");
    expect(wrapper.emitted("apply")[0][0].primary_light).toBe("#e8590c");
  });

  it("shows white as no vividness at all", async () => {
    const wrapper = mountDialog();
    await wrapper.get("#qs-hex").setValue("#ffffff");
    expect(out(wrapper, "vividness")).toBe("0%");
  });

  it("says so when the lightness bar leaves the color too vivid to show", async () => {
    const wrapper = mountDialog();
    expect(wrapper.find('[data-testid="qs-gamut"]').exists()).toBe(false);
    await wrapper.get("#qs-lightness").setValue("97");
    expect(wrapper.get('[data-testid="qs-gamut"]').text()).toContain("closest");
  });

  it("makes the dark demo deeper with the Dark depth bar and leaves the light demo alone", async () => {
    const wrapper = mountDialog();
    const light = previewStyle(wrapper, "light");
    const soft = previewStyle(wrapper, "dark");
    await wrapper.get("#qs-depth").setValue("100");
    expect(previewStyle(wrapper, "light")).toBe(light);
    expect(previewStyle(wrapper, "dark")).not.toBe(soft);
    expect(previewStyle(wrapper, "dark")).toContain(
      `--preview-background: ${deriveTheme("#2563eb", 1).background_dark}`,
    );
    expect(out(wrapper, "depth")).toBe("100%");
  });

  it("draws both demos compact so the two columns stay level, unlike the page's own Preview", () => {
    const wrapper = mountDialog();
    for (const mode of ["light", "dark"])
      expect(
        wrapper.get(`[data-testid="qs-preview-${mode}"]`).classes(),
      ).toContain("compact");
  });

  it("lists the six colors under the demos", () => {
    const text = mountDialog().get('[data-testid="qs-colors"]').text();
    for (const value of Object.values(deriveTheme("#2563eb", 0)))
      expect(text).toContain(value);
  });

  it("warns that links are darkened when the color is pale on the card", async () => {
    const wrapper = mountDialog();
    expect(wrapper.get('[data-testid="qs-note"]').text()).toContain(
      "six fields",
    );
    await swatch(wrapper, "Yellow").trigger("click");
    await wrapper.get("#qs-lightness").setValue("92");
    expect(wrapper.get('[data-testid="qs-note"]').text()).toContain(
      "darkens link text",
    );
    expect(wrapper.get('[data-testid="qs-note"]').text()).toContain("light");
  });

  it("applies all six derived colors and closes", async () => {
    const wrapper = mountDialog();
    await swatch(wrapper, "Violet").trigger("click");
    await wrapper.get("#qs-depth").setValue("50");
    await button(wrapper, "Apply").trigger("click");
    expect(wrapper.emitted("apply")).toEqual([[deriveTheme("#7c3aed", 0.5)]]);
    expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
  });

  it("closes without applying on Cancel, and when the dialog itself asks to close", async () => {
    const wrapper = mountDialog();
    await swatch(wrapper, "Pink").trigger("click");
    await button(wrapper, "Cancel").trigger("click");
    expect(wrapper.emitted("apply")).toBeUndefined();
    expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
    wrapper
      .findComponent({ name: "ElDialog" })
      .vm.$emit("update:modelValue", false);
    expect(wrapper.emitted("update:modelValue")).toHaveLength(2);
  });

  it("forgets unapplied choices when it is opened again", async () => {
    const wrapper = mountDialog();
    await swatch(wrapper, "Pink").trigger("click");
    await wrapper.setProps({ modelValue: false });
    await wrapper.setProps({ modelValue: true });
    expect(wrapper.get("#qs-hex").element.value).toBe("#2563eb");
  });
});
