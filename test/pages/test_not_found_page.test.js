import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { createPinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSiteBrandingStore } from "@/stores/siteBranding";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  route: { fullPath: "/admin-typo" },
}));

vi.mock("vue-router", () => ({
  useRoute: () => mocks.route,
}));

const RouterLinkStub = defineComponent({
  props: { to: { type: String, default: "" } },
  setup:
    (props, { slots }) =>
    () =>
      h("a", { href: props.to }, slots.default()),
});

vi.mock("@/components/AdminLayout.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      name: "AdminLayoutStub",
      setup(_, { slots }) {
        return () => h("main", slots.default ? slots.default() : []);
      },
    }),
  };
});

import NotFoundPage from "@/pages/[...path].vue";

describe("admin 404 page", () => {
  let pinia;
  let wrapper;
  beforeEach(() => {
    pinia = createPinia();
    wrapper = mount(NotFoundPage, {
      global: {
        plugins: [pinia],
        stubs: { ...ElementPlusStubs, RouterLink: RouterLinkStub },
      },
    });
  });
  afterEach(() => {
    wrapper.unmount();
    pinia._s.forEach((store) => store.$dispose());
  });

  it("says the page does not exist, names the path and links back to the dashboard", () => {
    expect(wrapper.get("h1").text()).toBe("Page not found");
    expect(wrapper.text()).toContain("/admin-typo");
    expect(wrapper.get("a").attributes("href")).toBe("/");
  });

  it("names the page for the browser tab", () => {
    expect(useSiteBrandingStore(pinia).pageTitle).toBe("Page not found");
  });
});
