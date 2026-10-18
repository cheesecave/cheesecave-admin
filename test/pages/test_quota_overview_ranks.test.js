import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { ElTag } from "element-plus";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  adminStore: { token: "admin-token" },
  getQuotaOverview: vi.fn(),
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.adminStore }));
vi.mock("@/utils/api", () => ({
  getQuotaOverview: (...args) => mocks.getQuotaOverview(...args),
  formatBytes: (value) => String(value ?? 0),
}));
vi.mock("@/components/AdminLayout.vue", () => ({
  default: defineComponent({
    setup(_, { slots }) {
      return () => h("main", slots.default ? slots.default() : []);
    },
  }),
}));

import QuotaOverviewPage from "@/pages/QuotaOverview.vue";

const consumer = (name, extra = {}) => ({
  username: name,
  is_org: false,
  private_used: 1,
  public_used: 1,
  total_used: 2,
  ...extra,
});

describe("quota overview rank tags", () => {
  let warn;
  beforeEach(() => {
    vi.clearAllMocks();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.getQuotaOverview.mockResolvedValue({
      system_storage: {
        private_used: 1,
        public_used: 1,
        lfs_used: 1,
        total_used: 3,
      },
      users_over_quota: [],
      repos_over_quota: [],
      top_consumers: [
        consumer("a"),
        consumer("b"),
        consumer("c"),
        consumer("d", { is_org: true }),
      ],
    });
  });
  afterEach(() => warn.mockRestore());

  it("gives every rank a tag type Element Plus accepts, including the ones after the podium", async () => {
    const wrapper = mount(QuotaOverviewPage, {
      global: {
        components: { ElTag },
        stubs: { ...ElementPlusStubs, ElTag: false },
        directives: { loading: {} },
      },
    });
    await flushPromises();

    const ranks = wrapper.findAll(".el-tag").map((tag) => tag.text());
    expect(ranks).toEqual(expect.arrayContaining(["#1", "#2", "#3", "#4"]));
    const invalidType = warn.mock.calls.filter(
      (call) =>
        call.join(" ").includes("Invalid prop") &&
        call.join(" ").includes("type"),
    );
    expect(invalidType).toEqual([]);
    wrapper.unmount();
  });
});
