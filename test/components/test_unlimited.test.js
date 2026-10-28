import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import QuotaBytes from "@/components/common/QuotaBytes.vue";
import Unlimited from "@/components/common/Unlimited.vue";

describe("Unlimited", () => {
  it('is the symbol, named "No limit" for a mouse and for a screen reader', () => {
    const symbol = mount(Unlimited).get("span");

    expect(symbol.text()).toBe("∞");
    expect(symbol.attributes("title")).toBe("No limit");
    expect(symbol.attributes("role")).toBe("img");
    expect(symbol.attributes("aria-label")).toBe("No limit");
  });
});

describe("QuotaBytes", () => {
  it("writes a size as a size", () => {
    const wrapper = mount(QuotaBytes, { props: { bytes: 1500 } });

    expect(wrapper.text()).toBe("1.5 KB");
    expect(wrapper.find('[role="img"]').exists()).toBe(false);
  });

  it("writes a quota without a limit as the symbol, to the right of a slash", () => {
    const wrapper = mount(QuotaBytes, { props: { bytes: null } });

    expect(wrapper.text()).toBe("∞");
    expect(wrapper.get('[role="img"]').attributes("aria-label")).toBe(
      "No limit",
    );
  });

  it("puts the word next to the symbol where the quota is all a field shows", () => {
    const wrapper = mount(QuotaBytes, {
      props: { bytes: null, standalone: true },
    });

    expect(wrapper.text()).toBe("∞ No limit");
    expect(wrapper.find('[role="img"]').exists()).toBe(false);
  });

  it("writes an unknown figure as a dash, never as the symbol", () => {
    expect(mount(QuotaBytes, { props: { bytes: undefined } }).text()).toBe("—");
    expect(mount(QuotaBytes).text()).toBe("—");
  });
});
