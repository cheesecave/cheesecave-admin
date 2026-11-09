import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  adminStore: { token: "admin-token", logout: vi.fn() },
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

describe("quota overview: a row opens the account or the repository it names", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getQuotaOverview.mockResolvedValue({
      system_storage: { private_used: 1, public_used: 1, lfs_used: 1, total_used: 3 },
      users_over_quota: [{ username: "over-user", is_org: false, private_used: 9, private_quota: 5, public_used: 0, public_quota: 5, private_percentage: 180, public_percentage: 0 }],
      repos_over_quota: [{ full_id: "owner/big", repo_type: "dataset", used_bytes: 9, quota_bytes: 5, percentage: 180 }],
      top_consumers: [{ username: "top-org", is_org: true, private_used: 1, public_used: 1, total_used: 2 }],
    });
  });

  async function mountPage() {
    const wrapper = mount(QuotaOverviewPage, { global: { stubs: ElementPlusStubs, directives: { loading: {} } } });
    await flushPromises();
    return wrapper;
  }

  it("opens an over-quota user, a top consumer, and a repository, each with its own link", async () => {
    const w = await mountPage();
    const viewButtons = () => w.findAll("button").filter((b) => ["View", "over-user"].includes(b.text()));

    await w.findAll("button").find((b) => b.text() === "over-user").trigger("click");
    expect(mocks.router.push).toHaveBeenLastCalledWith({ path: "/users", query: { open: "over-user" } });

    const views = viewButtons().filter((b) => b.text() === "View");
    await views[0].trigger("click"); // the repository row comes first in the page
    await views[1].trigger("click");
    const targets = mocks.router.push.mock.calls.map((c) => c[0]);
    expect(targets).toContainEqual({ path: "/repositories", query: { q: "owner/big", open: "dataset:owner/big" } });
    expect(targets).toContainEqual({ path: "/users", query: { open: "top-org" } });
  });

  it("no longer announces the navigation with a toast", async () => {
    const w = await mountPage();
    await w.findAll("button").find((b) => b.text() === "over-user").trigger("click");

    expect(document.body.textContent).not.toContain("Navigate to user");
  });
});
