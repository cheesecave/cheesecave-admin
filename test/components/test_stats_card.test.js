import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import StatsCard from "@/components/StatsCard.vue";

const source = readFileSync(
  resolve(process.cwd(), "src/components/StatsCard.vue"),
  "utf8",
);
const channel = (v) => {
  const x = v / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const whiteContrast = (hex) => 1.05 / (luminance(hex) + 0.05);

describe("StatsCard", () => {
  const mountCard = (props = {}) =>
    mount(StatsCard, {
      props: {
        title: "Total Users",
        value: 19,
        subtitle: "Active: 19",
        ...props,
      },
    });

  it("is one card: the coloured tile itself, not a tile inside a white card", () => {
    const wrapper = mountCard({ color: "green" });

    expect(wrapper.find(".el-card").exists()).toBe(false);
    expect(wrapper.classes()).toContain("stat-card");
    expect(wrapper.classes()).toContain("from-green-500");
  });

  it("shows the value, the title and the subtitle", () => {
    const wrapper = mountCard();

    expect(wrapper.get(".stat-value").text()).toBe("19");
    expect(wrapper.get(".stat-title").text()).toBe("Total Users");
    expect(wrapper.get(".stat-subtitle").text()).toBe("Active: 19");
    expect(wrapper.get(".stat-subtitle").attributes("aria-hidden")).toBe(
      "false",
    );
  });

  it("hides an empty subtitle from assistive technology but keeps its space", () => {
    const wrapper = mountCard({ subtitle: "" });

    expect(wrapper.get(".stat-subtitle").attributes("aria-hidden")).toBe(
      "true",
    );
  });

  it("draws every tile's white text at AA contrast over the whole gradient", () => {
    const colours = [
      ...source.matchAll(/--tw-gradient-(?:from|to):\s*(#[0-9a-fA-F]{6})/g),
    ].map((match) => match[1]);

    expect(colours.length).toBeGreaterThanOrEqual(14);
    for (const colour of colours) {
      expect(whiteContrast(colour), colour).toBeGreaterThanOrEqual(4.5);
    }
  });
});
