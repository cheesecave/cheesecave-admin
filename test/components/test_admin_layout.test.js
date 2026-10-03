import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
  route: {
    path: "/repositories",
  },
  adminStore: {
    logout: vi.fn(),
  },
  themeStore: {
    isDark: false,
    toggle: vi.fn(),
  },
  siteBrandingStore: {
    branding: { site_name: "DeepGHS Hub", header_logo: null },
  },
  globalSearch: {
    openDialog: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
  useRoute: () => mocks.route,
}));

vi.mock("@/stores/admin", () => ({
  useAdminStore: () => mocks.adminStore,
}));

vi.mock("@/stores/theme", () => ({
  useThemeStore: () => mocks.themeStore,
}));

vi.mock("@/stores/siteBranding", () => ({
  useSiteBrandingStore: () => mocks.siteBrandingStore,
}));

vi.mock("element-plus", async () => {
  const actual = await vi.importActual("element-plus");
  return actual;
});

vi.mock("@/components/GlobalSearch.vue", () => ({
  default: defineComponent({
    name: "GlobalSearch",
    setup(_, { expose }) {
      expose({
        openDialog: mocks.globalSearch.openDialog,
      });

      return () => h("div", { "data-global-search": "true" });
    },
  }),
}));

import AdminLayout from "@/components/AdminLayout.vue";

describe("AdminLayout", () => {
  const wrappers = [];
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.route.path = "/repositories";
    mocks.themeStore.isDark = false;
  });
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  });

  function mountLayout() {
    const wrapper = mount(AdminLayout, {
      slots: {
        default:
          '<section data-slot-content="true">Dashboard content</section>',
      },
      global: {
        stubs: ElementPlusStubs,
      },
    });
    wrappers.push(wrapper);
    return wrapper;
  }

  it.each([false, true])("shows the frontend commit with dirty=%s", (dirty) => {
    const commit = "0123456789abcdef0123456789abcdef01234567";
    vi.stubGlobal("__BUILD_INFO__", { commit, dirty });
    const version = mountLayout().get('[data-testid="frontend-version"]');

    expect(version.text()).toBe(`Frontend 0123456${dirty ? "-dirty" : ""}`);
    expect(version.attributes("title")).toContain(commit);
    expect(version.attributes("title").includes("uncommitted changes")).toBe(
      dirty,
    );
    const commitLink = version.get("a");
    expect(commitLink.attributes("href")).toBe(
      `https://github.com/cheesecave/cheesecave-admin/commit/${commit}`,
    );
    expect(commitLink.text()).toBe(`0123456${dirty ? "-dirty" : ""}`);
    expect(commitLink.attributes("target")).toBe("_blank");
    expect(commitLink.attributes("rel")).toBe("noopener noreferrer");
    expect(commitLink.attributes("aria-label")).toContain(commit);
  });

  it("shows an explicit unknown version when build metadata is unavailable", () => {
    vi.stubGlobal("__BUILD_INFO__", { commit: "unknown", dirty: false });
    const version = mountLayout().get('[data-testid="frontend-version"]');

    expect(version.text()).toBe("Frontend unknown");
    expect(version.attributes("title")).toBe("Frontend Git commit unavailable");
    expect(version.find("a").exists()).toBe(false);
  });

  it("renders the admin navigation, opens global search, and toggles theme", async () => {
    const wrapper = mountLayout();

    expect(wrapper.text()).toContain("Admin Portal");
    expect(wrapper.text()).toContain("Repositories");
    expect(wrapper.text()).toContain("Quota Overview");
    expect(wrapper.findAll('[data-index="/site"]')).toHaveLength(1);
    expect(wrapper.get('[data-index="/site"]').text()).toBe("Site");
    expect(wrapper.find('[data-index="/homepage"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("DeepGHS Hub Administration");
    expect(wrapper.get("h1").attributes("title")).toBe(
      "DeepGHS Hub Administration",
    );
    expect(wrapper.find('[data-index="/site-branding"]').exists()).toBe(false);
    expect(wrapper.find('[data-slot-content="true"]').exists()).toBe(true);

    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Search"))
      .trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.attributes("data-circle") === "true")
      .trigger("click");

    expect(mocks.globalSearch.openDialog).toHaveBeenCalledTimes(1);
    expect(mocks.themeStore.toggle).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-global-search="true"]').exists()).toBe(true);
  });

  it("logs out and returns to the login page", async () => {
    const wrapper = mountLayout();

    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Logout"))
      .trigger("click");

    expect(mocks.adminStore.logout).toHaveBeenCalledTimes(1);
    expect(mocks.router.push).toHaveBeenCalledWith("/login");
  });

  it("opens collapsed mobile navigation and closes it when a page is selected", async () => {
    const wrapper = mountLayout();
    const toggle = wrapper.get('[aria-label="Open navigation"]');
    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(wrapper.get("#admin-navigation").classes()).not.toContain(
      "sidebar-open",
    );
    expect(wrapper.find(".navigation-backdrop").exists()).toBe(false);
    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("true");
    expect(wrapper.get("#admin-navigation").classes()).toContain(
      "sidebar-open",
    );
    expect(wrapper.get(".content-layout").attributes()).toHaveProperty("inert");
    await wrapper.get('[data-index="/site"]').trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(wrapper.find(".navigation-backdrop").exists()).toBe(false);
    expect(wrapper.get(".content-layout").attributes()).not.toHaveProperty(
      "inert",
    );
  });

  it.each(["close button", "backdrop", "Escape"])(
    "dismisses the mobile drawer through %s",
    async (action) => {
      const wrapper = mountLayout();
      await wrapper.get('[aria-label="Open navigation"]').trigger("click");
      if (action === "close button") {
        await wrapper.get('[aria-label="Close navigation"]').trigger("click");
      } else if (action === "backdrop") {
        await wrapper.get(".navigation-backdrop").trigger("click");
      } else {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        await nextTick();
      }
      expect(wrapper.get("#admin-navigation").classes()).not.toContain(
        "sidebar-open",
      );
      expect(wrapper.find(".navigation-backdrop").exists()).toBe(false);
    },
  );

  it("closes the mobile drawer when the viewport returns to desktop", async () => {
    const wrapper = mountLayout();
    await wrapper.get('[aria-label="Open navigation"]').trigger("click");
    window.dispatchEvent(new Event("resize"));
    await nextTick();
    expect(wrapper.get("#admin-navigation").classes()).not.toContain(
      "sidebar-open",
    );
    expect(wrapper.get(".content-layout").attributes()).not.toHaveProperty(
      "inert",
    );
  });
});
