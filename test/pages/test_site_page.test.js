import { defineComponent, h } from "vue";
import { createPinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElementPlusStubs } from "../helpers/vue";
import { DEFAULT_HOMEPAGE } from "../../src/shared/site-homepage.js";

const mocks = vi.hoisted(() => ({
  adminStore: { token: "admin-token", logout: vi.fn() },
  getSiteBranding: vi.fn(),
  updateSiteBranding: vi.fn(),
  uploadSiteBrandingAsset: vi.fn(),
  updateSiteBrandingAssetAnimation: vi.fn(),
  resetSiteBrandingAsset: vi.fn(),
  getSiteHomepage: vi.fn(),
  updateSiteHomepage: vi.fn(),
}));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.adminStore }));
vi.mock("@/utils/api", () => ({
  getSiteBranding: (...args) => mocks.getSiteBranding(...args),
  updateSiteBranding: (...args) => mocks.updateSiteBranding(...args),
  uploadSiteBrandingAsset: (...args) => mocks.uploadSiteBrandingAsset(...args),
  updateSiteBrandingAssetAnimation: (...args) =>
    mocks.updateSiteBrandingAssetAnimation(...args),
  resetSiteBrandingAsset: (...args) => mocks.resetSiteBrandingAsset(...args),
  getSiteHomepage: (...args) => mocks.getSiteHomepage(...args),
  updateSiteHomepage: (...args) => mocks.updateSiteHomepage(...args),
}));
vi.mock("@/components/AdminLayout.vue", () => ({
  default: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h("main", { "data-admin-layout": true }, slots.default?.()),
  }),
}));

import SitePage from "@/pages/site.vue";
import legacyHomepageSource from "@/pages/homepage.vue?raw";
import legacyBrandingSource from "@/pages/site-branding.vue?raw";

// Vitest omits the route-generation plugin. Read these static macro declarations
// into the memory router; the production build separately verifies code generation.
const routeMetadata = (source) =>
  JSON.parse(
    source
      .match(/definePage\(([\s\S]*?)\);/)[1]
      .replace(/\b(redirect|path|query|tab)\s*:/g, '"$1":')
      .replace(/,\s*([}\]])/g, "$1"),
  );

const branding = {
  site_name: "DeepGHS Hub",
  footer_description: "Models for everyone",
  header_logo: null,
  favicon: null,
};
const HeroStub = defineComponent({
  props: { config: Object, preview: Boolean },
  setup: (props) => () => h("div", { "data-hero": true }, props.config.title),
});

describe("consolidated Site administration", () => {
  let wrapper;
  let router;
  let pinia;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminStore.token = "admin-token";
    mocks.getSiteBranding.mockResolvedValue({ ...branding });
    mocks.getSiteHomepage.mockResolvedValue({ ...DEFAULT_HOMEPAGE });
    pinia = createPinia();
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/site", component: SitePage },
        { path: "/homepage", ...routeMetadata(legacyHomepageSource) },
        { path: "/site-branding", ...routeMetadata(legacyBrandingSource) },
        {
          path: "/login",
          component: defineComponent({ render: () => h("div") }),
        },
      ],
    });
  });
  afterEach(() => {
    wrapper?.unmount();
    pinia._s.forEach((store) => store.$dispose());
  });

  async function mountPage(url = "/site", component = SitePage) {
    await router.push(url);
    await router.isReady();
    wrapper = mount(component, {
      attachTo: document.body,
      global: {
        plugins: [pinia, router],
        stubs: { ...ElementPlusStubs, HomepageHero: HeroStub },
      },
    });
    await flushPromises();
    return wrapper;
  }

  it("defaults to Branding and renders one shared page heading and layout", async () => {
    await mountPage();
    expect(wrapper.findAll("[data-admin-layout]")).toHaveLength(1);
    expect(wrapper.findAll("h1").map((heading) => heading.text())).toEqual([
      "Site",
    ]);
    expect(wrapper.get('[role="tablist"]').attributes("aria-label")).toBe(
      "Site settings",
    );
    expect(wrapper.get("#site-branding-tab").attributes("aria-selected")).toBe(
      "true",
    );
    expect(wrapper.get("#site-homepage-tab").attributes("aria-selected")).toBe(
      "false",
    );
    expect(
      wrapper.get("#site-branding-panel").attributes("aria-labelledby"),
    ).toBe("site-branding-tab");
    expect(wrapper.get("#site-name").element.value).toBe(branding.site_name);
    expect(mocks.getSiteBranding).toHaveBeenCalledExactlyOnceWith(
      "admin-token",
    );
    expect(mocks.getSiteHomepage).not.toHaveBeenCalled();
  });

  it("opens a direct Homepage tab URL without loading Branding", async () => {
    await mountPage("/site?tab=homepage");
    expect(wrapper.findAll("[data-admin-layout]")).toHaveLength(1);
    expect(wrapper.findAll("h1").map((heading) => heading.text())).toEqual([
      "Site",
    ]);
    expect(wrapper.get("#site-homepage-tab").attributes("aria-selected")).toBe(
      "true",
    );
    expect(
      wrapper.get("#site-homepage-panel").attributes("aria-labelledby"),
    ).toBe("site-homepage-tab");
    expect(wrapper.get("#homepage-title").element.value).toBe(
      DEFAULT_HOMEPAGE.title,
    );
    expect(wrapper.find("#site-name").exists()).toBe(false);
    expect(mocks.getSiteHomepage).toHaveBeenCalledExactlyOnceWith(
      "admin-token",
    );
    expect(mocks.getSiteBranding).not.toHaveBeenCalled();
  });

  it("falls back to Branding for an unknown tab", async () => {
    await mountPage("/site?tab=unknown");
    expect(wrapper.get("#site-branding-tab").attributes("aria-selected")).toBe(
      "true",
    );
    expect(wrapper.find("#site-name").exists()).toBe(true);
    expect(mocks.getSiteHomepage).not.toHaveBeenCalled();
  });

  it("updates the tab URL while preserving other query parameters and unsaved drafts", async () => {
    await mountPage("/site?source=sidebar");
    await wrapper.get("#site-name").setValue("Unsaved branding");
    await wrapper.get("#footer-description").setValue("An unsaved footer");
    await wrapper.get("#site-homepage-tab").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({
      source: "sidebar",
      tab: "homepage",
    });
    await wrapper.get("#homepage-title").setValue("Unsaved homepage");
    await wrapper.get("#homepage-animation").setValue(false);
    await wrapper.get("#site-branding-tab").trigger("click");
    await flushPromises();
    expect(wrapper.get("#site-name").element.value).toBe("Unsaved branding");
    expect(wrapper.get("#footer-description").element.value).toBe(
      "An unsaved footer",
    );
    await wrapper.get("#site-homepage-tab").trigger("click");
    await flushPromises();
    expect(wrapper.get("#homepage-title").element.value).toBe(
      "Unsaved homepage",
    );
    expect(wrapper.get("#homepage-animation").element.checked).toBe(false);
    expect(mocks.getSiteBranding).toHaveBeenCalledOnce();
    expect(mocks.getSiteHomepage).toHaveBeenCalledOnce();
    expect(mocks.updateSiteBranding).not.toHaveBeenCalled();
    expect(mocks.updateSiteHomepage).not.toHaveBeenCalled();
  });

  it("supports keyboard tab selection with focus and selection kept in sync", async () => {
    await mountPage();
    await wrapper.get("#site-branding-tab").trigger("keydown", { key: "End" });
    await flushPromises();
    expect(router.currentRoute.value.query.tab).toBe("homepage");
    expect(document.activeElement).toBe(
      wrapper.get("#site-homepage-tab").element,
    );
    expect(wrapper.get("#site-homepage-tab").attributes("tabindex")).toBe("0");
    await wrapper
      .get("#site-homepage-tab")
      .trigger("keydown", { key: "ArrowRight" });
    await flushPromises();
    expect(router.currentRoute.value.query.tab).toBe("branding");
    expect(document.activeElement).toBe(
      wrapper.get("#site-branding-tab").element,
    );
    expect(wrapper.get("#site-homepage-tab").attributes("tabindex")).toBe("-1");
  });

  it("responds to route navigation between tabs without losing drafts", async () => {
    await mountPage("/site?tab=homepage");
    await wrapper.get("#homepage-title").setValue("A retained draft");
    await router.push("/site?tab=branding");
    await flushPromises();
    expect(wrapper.find("#site-name").exists()).toBe(true);
    await router.back();
    await vi.waitFor(() =>
      expect(wrapper.find("#homepage-title").exists()).toBe(true),
    );
    expect(wrapper.get("#homepage-title").element.value).toBe(
      "A retained draft",
    );
    expect(mocks.getSiteHomepage).toHaveBeenCalledOnce();
  });

  it.each([
    ["/homepage", "homepage"],
    ["/site-branding", "branding"],
  ])(
    "redirects the legacy %s page to the corresponding Site tab",
    async (url, tab) => {
      await mountPage(url);
      expect(router.currentRoute.value.path).toBe("/site");
      expect(router.currentRoute.value.query).toEqual({ tab });
      expect(wrapper.get(`#site-${tab}-tab`).attributes("aria-selected")).toBe(
        "true",
      );
      expect(wrapper.findAll("[data-admin-layout]")).toHaveLength(1);
    },
  );
});
