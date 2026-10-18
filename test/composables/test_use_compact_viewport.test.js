import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useCompactViewport } from "@/composables/useCompactViewport";

function stubMedia(matches) {
  const listeners = new Set();
  const query = {
    matches,
    addEventListener: vi.fn((_, fn) => listeners.add(fn)),
    removeEventListener: vi.fn((_, fn) => listeners.delete(fn)),
  };
  const matchMedia = vi.fn(() => query);
  vi.stubGlobal("matchMedia", matchMedia);
  return { query, matchMedia, listeners };
}

function mountProbe(width) {
  let compact;
  const wrapper = mount(
    defineComponent({
      setup() {
        compact = useCompactViewport(width);
        return () => h("span", String(compact.value));
      },
    }),
  );
  return { wrapper, compact: () => compact.value };
}

describe("useCompactViewport", () => {
  it("starts from the current width, 768 px by default", () => {
    const { matchMedia } = stubMedia(true);
    const { wrapper, compact } = mountProbe();

    expect(matchMedia).toHaveBeenCalledWith("(max-width: 768px)");
    expect(compact()).toBe(true);
    wrapper.unmount();
  });

  it("follows the viewport crossing the breakpoint and lets go on unmount", () => {
    const { listeners, query, matchMedia } = stubMedia(false);
    const { wrapper, compact } = mountProbe(1024);
    expect(matchMedia).toHaveBeenCalledWith("(max-width: 1024px)");
    expect(compact()).toBe(false);

    [...listeners].forEach((fn) => fn({ matches: true }));
    expect(compact()).toBe(true);
    [...listeners].forEach((fn) => fn({ matches: false }));
    expect(compact()).toBe(false);

    wrapper.unmount();
    expect(query.removeEventListener).toHaveBeenCalledOnce();
    expect(listeners.size).toBe(0);
  });
});
