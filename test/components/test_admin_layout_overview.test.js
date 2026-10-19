import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  route: { path: "/users" },
  admin: { token: "admin-token", logout: vi.fn() },
  getOverview: vi.fn(),
  error: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
  useRoute: () => mocks.route,
}));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.admin }));
vi.mock("@/stores/theme", () => ({
  useThemeStore: () => ({ isDark: false, toggle: vi.fn() }),
}));
vi.mock("@/stores/siteBranding", () => ({
  useSiteBrandingStore: () => ({
    branding: { site_name: "Hub" },
    setPageTitle: vi.fn(),
  }),
}));
vi.mock("@/components/GlobalSearch.vue", () => ({
  default: defineComponent({ setup: () => () => h("div") }),
}));
vi.mock("@/utils/api", async () => ({
  ...(await vi.importActual("@/utils/api")),
  getOverview: (...args) => mocks.getOverview(...args),
}));

import AdminLayout from "@/components/AdminLayout.vue";
import { useOverviewStore } from "@/stores/overview";

const overview = {
  schema: 1,
  generated_at: "2026-10-19T12:00:00Z",
  sections: {
    queue: { queued: 5, running: 0, failed_24h: 2 },
    health: { status: "ok" },
    attention: { items: [{ id: "quota", count: 3 }] },
  },
};

describe("AdminLayout and the overview poll", () => {
  let wrapper;
  const mountLayout = () =>
    mount(AdminLayout, {
      slots: { default: "<p>page</p>" },
      global: { stubs: ElementPlusStubs },
    });
  const item = (path) => wrapper.get(`[data-index="${path}"]`);

  beforeEach(async () => {
    mocks.router.push.mockReset();
    mocks.admin.token = "admin-token";
    mocks.admin.logout.mockReset();
    mocks.getOverview.mockReset().mockResolvedValue(overview);
    const elementPlus = await vi.importActual("element-plus");
    vi.spyOn(elementPlus.ElMessage, "error").mockImplementation(mocks.error);
    vi.spyOn(elementPlus.ElMessage, "success").mockImplementation(() => {});
    mocks.error.mockReset();
    setActivePinia(createPinia());
  });
  afterEach(() => {
    useOverviewStore().stop();
    wrapper?.unmount();
    vi.restoreAllMocks();
  });

  it("starts the shared poll once, however many pages mount the layout", async () => {
    wrapper = mountLayout();
    await flushPromises();
    const second = mountLayout();
    await flushPromises();
    second.unmount();

    expect(mocks.getOverview).toHaveBeenCalledTimes(1);
  });

  it("puts a labelled badge on the menu entries that need a look, and only those", async () => {
    wrapper = mountLayout();
    await flushPromises();

    const tasks = item("/tasks").get(".nav-badge");
    expect(tasks.text()).toBe("2");
    expect(tasks.classes()).toContain("danger");
    expect(tasks.attributes("aria-label")).toBe("2 need attention");
    const quota = item("/QuotaOverview").get(".nav-badge");
    expect(quota.text()).toBe("3");
    expect(quota.classes()).toContain("warning");
    expect(item("/users").find(".nav-badge").exists()).toBe(false);
    expect(item("/health").find(".nav-badge").exists()).toBe(false);
  });

  it("forgets the overview on logout", async () => {
    wrapper = mountLayout();
    await flushPromises();
    await wrapper.get(".logout-button").trigger("click");

    expect(mocks.admin.logout).toHaveBeenCalled();
    expect(mocks.router.push).toHaveBeenCalledWith("/login");
    const store = useOverviewStore();
    expect(store.running).toBe(false);
    expect(store.sections).toEqual({});
  });

  it("signs out and says why when the poll learns the admin token is no longer valid", async () => {
    mocks.getOverview
      .mockReset()
      .mockRejectedValue(
        Object.assign(new Error("401"), { response: { status: 401 } }),
      );
    wrapper = mountLayout();
    await flushPromises();

    expect(mocks.admin.logout).toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(
      "Invalid admin token. Please login again.",
    );
    expect(mocks.router.push).toHaveBeenCalledWith("/login");
    expect(useOverviewStore().unauthorized).toBe(false);
  });
});
