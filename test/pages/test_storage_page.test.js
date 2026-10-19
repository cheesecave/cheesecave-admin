import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  adminStore: { token: "admin-token", logout: vi.fn() },
  error: vi.fn(),
}));

const routeState = vi.hoisted(() => ({ query: {} }));
vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
  useRoute: () => routeState,
}));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.adminStore }));
vi.mock("@/utils/api", () => ({
  listS3Buckets: vi.fn(),
  listS3Objects: vi.fn().mockResolvedValue({ objects: [] }),
  deleteS3Object: vi.fn(),
  prepareDeleteS3Prefix: vi.fn(),
  deleteS3Prefix: vi.fn(),
  formatBytes: (bytes) => `${bytes} B`,
}));

function stub(name, testid) {
  return {
    default: defineComponent({
      name,
      props: { token: { type: String, default: "" } },
      emits: ["error"],
      setup(props) {
        return () =>
          h("section", { "data-testid": testid, "data-token": props.token });
      },
    }),
  };
}

vi.mock("@/components/AdminLayout.vue", () => ({
  default: defineComponent({
    setup(_, { slots }) {
      return () => h("main", slots.default ? slots.default() : []);
    },
  }),
}));
vi.mock("@/components/storage/OrphanLakefsRepos.vue", () =>
  stub("OrphanLakefsRepos", "orphans"),
);
vi.mock("@/components/storage/LfsReconciliation.vue", () =>
  stub("LfsReconciliation", "lfs"),
);
vi.mock("@/components/storage/UsageRecount.vue", () =>
  stub("UsageRecount", "usage"),
);

import StoragePage from "@/pages/storage.vue";

describe("admin storage page", () => {
  beforeEach(async () => {
    mocks.error.mockReset();
    // See test_cache_page.test.js: element-plus is spied on, not mocked.
    const elementPlus = await vi.importActual("element-plus");
    vi.spyOn(elementPlus.ElMessage, "error").mockImplementation(mocks.error);
  });

  it("shows the usage recount and reports its failures", async () => {
    const wrapper = mount(StoragePage, { global: { stubs: ElementPlusStubs } });
    await flushPromises();

    const recount = wrapper.findComponent({ name: "UsageRecount" });
    expect(recount.attributes("data-token")).toBe("admin-token");
    recount.vm.$emit("error", {
      response: { data: { detail: { error: "no worker" } } },
    });
    expect(mocks.error).toHaveBeenLastCalledWith("no worker");
    recount.vm.$emit("error", new Error("offline"));
    expect(mocks.error).toHaveBeenLastCalledWith(
      "Storage usage recount failed",
    );
  });
});

describe("storage opened from the Overview", () => {
  let scroll;
  beforeEach(async () => {
    const { listS3Objects } = await import("@/utils/api");
    listS3Objects.mockResolvedValue({ objects: [] });
    vi.useFakeTimers();
    mocks.adminStore.token = "admin-token";
    scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
  });
  afterEach(() => {
    vi.useRealTimers();
    routeState.query = {};
    delete Element.prototype.scrollIntoView;
  });

  it.each([
    ["orphans", "storage-orphans", '[data-testid="orphans"]'],
    ["lfs", "storage-lfs", '[data-testid="lfs"]'],
  ])("tab=%s scrolls to that section, marks it for a moment, then lets go", async (tab, id, selector) => {
    routeState.query = { tab };
    const wrapper = mount(StoragePage, { attachTo: document.body, global: { stubs: ElementPlusStubs } });
    await vi.advanceTimersByTimeAsync(0);

    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(scroll.mock.contexts[0].id).toBe(id);
    expect(wrapper.get(selector).classes()).toContain("deep-link-highlight");
    expect(wrapper.get('[data-testid="usage"]').classes()).not.toContain("deep-link-highlight");

    await vi.advanceTimersByTimeAsync(2500);
    expect(wrapper.get(selector).classes()).not.toContain("deep-link-highlight");
    wrapper.unmount();
  });

  it("does nothing special without a known tab", async () => {
    routeState.query = { tab: "bogus" };
    const wrapper = mount(StoragePage, { global: { stubs: ElementPlusStubs } });
    await vi.advanceTimersByTimeAsync(0);
    expect(scroll).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("forgets the highlight timer when it goes away early", async () => {
    routeState.query = { tab: "lfs" };
    const wrapper = mount(StoragePage, { attachTo: document.body, global: { stubs: ElementPlusStubs } });
    await vi.advanceTimersByTimeAsync(0);
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
