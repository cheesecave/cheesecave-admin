import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

import { ElementPlusStubs } from "../helpers/vue";
import { RouterLinkStub } from "../helpers/router";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  admin: { token: "admin-token", logout: vi.fn() },
  getOverview: vi.fn(),
  loadLegacyOverview: vi.fn(),
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.admin }));
vi.mock("@/utils/api", async () => ({
  ...(await vi.importActual("@/utils/api")),
  getOverview: (...args) => mocks.getOverview(...args),
}));
vi.mock("@/utils/overview-legacy", () => ({
  loadLegacyOverview: (...args) => mocks.loadLegacyOverview(...args),
}));
vi.mock("@/components/AdminLayout.vue", () => ({
  default: defineComponent({
    setup(_, { slots }) {
      return () => h("div", slots.default?.());
    },
  }),
}));
vi.mock("@/components/ChartCard.vue", () => ({
  default: defineComponent({
    props: ["title", "labels", "datasets", "height"],
    setup(props) {
      return () =>
        h("div", {
          "data-testid": "chart",
          "data-title": props.title,
          "data-labels": JSON.stringify(props.labels),
          "data-datasets": JSON.stringify(props.datasets.map((d) => d.data)),
        });
    },
  }),
}));

import OverviewPage from "@/pages/index.vue";
import { useOverviewStore } from "@/stores/overview";

const NOW = "2026-10-19T12:00:00Z";
const counts = {
  users: { total: 25, delta: 1, series: [0, 1, 0] },
  orgs: 9,
  repos: { total: 502, private: 71, delta: 9, series: [1, 2] },
  commits: { total: 78701, delta: 1420, series: [3, 4] },
  storage: { total: 48e12, private: 6.1e12, public: 41.9e12 },
  lfs: { objects: 1130994, size: 48.7e12 },
};
const FULL = {
  schema: 1,
  generated_at: NOW,
  range: "7d",
  sections: {
    health: {
      status: "ok",
      dependencies: [
        { name: "postgres", status: "ok", latency_ms: 12, detail: null },
      ],
    },
    workers: { online: 3, draining: 0, lost: 0 },
    queue: {
      queued: 5,
      running: 1,
      succeeded_24h: 425,
      failed_24h: 2,
      oldest_queued_age_s: 9,
      hourly: [{ ok: 1, failed: 0 }],
    },
    build: { backend: "3fd3765" },
    attention: {
      items: [
        {
          id: "quota",
          severity: "warning",
          title: "3 users are over their storage quota",
          count: 3,
          hint: null,
          link: {
            path: "/users",
            query: { filter: "over_quota" },
            label: "Users over quota",
          },
        },
      ],
    },
    counts,
    activity: {
      range: "7d",
      bucket: "day",
      labels: ["10-18", "10-19"],
      commits: [5, 7],
      repos: [1, 0],
      users: [0, 1],
    },
    recent: {
      items: [
        {
          id: "user:1",
          kind: "user",
          actor: "mai_lin",
          text: "joined",
          at: NOW,
          link: "/users",
        },
      ],
    },
    top: {
      by_commits: [{ repo_type: "dataset", repo_full_id: "o/n", commits: 9 }],
      by_size: [],
    },
  },
};
const httpError = (status) =>
  Object.assign(new Error("x"), { response: { status } });
const settle = () => vi.advanceTimersByTimeAsync(0);

function mountPage() {
  return mount(OverviewPage, {
    global: { stubs: { ...ElementPlusStubs, RouterLink: RouterLinkStub } },
  });
}

describe("Overview page", () => {
  let wrapper;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    mocks.router.push.mockReset();
    mocks.admin.token = "admin-token";
    mocks.getOverview.mockReset().mockResolvedValue(FULL);
    mocks.loadLegacyOverview.mockReset();
    setActivePinia(createPinia());
  });
  afterEach(() => {
    useOverviewStore().stop();
    wrapper?.unmount();
    vi.useRealTimers();
  });

  it("answers the three questions: status, what needs attention, what is happening", async () => {
    wrapper = mountPage();
    await settle();

    expect(wrapper.get('[data-testid="status-dep-postgres"]').exists()).toBe(
      true,
    );
    expect(wrapper.get('[data-testid="status-build"]').text()).toBe(
      "backend 3fd3765",
    );
    expect(wrapper.get('[data-testid="attention-quota"]').text()).toContain(
      "3 users are over",
    );
    const kpis = wrapper.get('[data-testid="kpis"]').text();
    expect(kpis).toContain("78,701");
    expect(kpis).toContain("+1,420 / 7d");
    expect(kpis).toContain("9 organizations");
    expect(kpis).toContain("71 private");
    expect(kpis).toContain("1,130,994");
    expect(kpis).toContain("48 TB");
    const chart = wrapper.get('[data-testid="chart"]');
    expect(chart.attributes("data-title")).toBe("Activity · last 7d");
    expect(JSON.parse(chart.attributes("data-labels"))).toEqual([
      "10-18",
      "10-19",
    ]);
    expect(JSON.parse(chart.attributes("data-datasets"))).toEqual([
      [5, 7],
      [1, 0],
    ]);
    expect(wrapper.get('[data-testid="queue-failed"]').text()).toContain("2");
    expect(wrapper.get('[data-testid="recent-user"]').text()).toContain(
      "mai_lin",
    );
    expect(wrapper.findAll('[data-testid="top-row"]')).toHaveLength(1);
    expect(wrapper.get('[data-testid="launch-card"] .b.warning').text()).toBe(
      "3",
    );
    expect(wrapper.get('[data-testid="freshness"]').text()).toBe(
      "Updated just now",
    );
    expect(wrapper.find('[data-testid="legacy-banner"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="error-banner"]').exists()).toBe(false);
  });

  it("sends an unauthenticated visitor to the login page without fetching", async () => {
    mocks.admin.token = "";
    wrapper = mountPage();
    await settle();
    expect(mocks.router.push).toHaveBeenCalledWith("/login");
    expect(mocks.getOverview).not.toHaveBeenCalled();
  });

  it("the interval, range and refresh controls drive the store", async () => {
    wrapper = mountPage();
    await settle();
    const store = useOverviewStore();

    await wrapper.get('[data-testid="interval"]').setValue("60");
    expect(store.interval).toBe(60);
    await wrapper.get('[data-testid="interval"]').setValue("0");
    expect(store.interval).toBe(0);

    await wrapper.get('[data-testid="range-24h"]').trigger("click");
    await settle();
    expect(store.range).toBe("24h");
    expect(mocks.getOverview).toHaveBeenLastCalledWith("admin-token", {
      sections: ["counts", "recent", "activity", "top", "build"],
      range: "24h",
    });
    expect(
      wrapper.get('[data-testid="range-24h"]').attributes("aria-pressed"),
    ).toBe("true");
    expect(
      wrapper.get('[data-testid="range-7d"]').attributes("aria-pressed"),
    ).toBe("false");
    expect(wrapper.get('[data-testid="chart"]').attributes("data-title")).toBe(
      "Activity · last 24h",
    );

    const before = mocks.getOverview.mock.calls.length;
    await wrapper.get('[data-testid="refresh"]').trigger("click");
    await settle();
    expect(mocks.getOverview).toHaveBeenCalledTimes(before + 1);
    expect(mocks.getOverview.mock.calls[before][1].sections).toBeUndefined();
  });

  it("marks stale data as stale, and announces only that change of state", async () => {
    wrapper = mountPage();
    await settle();
    const store = useOverviewStore();
    store.setIntervalSeconds(0);
    store.setIntervalSeconds(30);
    mocks.getOverview
      .mockReset()
      .mockImplementation(() => new Promise(() => {}));
    expect(wrapper.get('[data-testid="freshness-state"]').text()).toBe("");

    vi.setSystemTime(Date.now() + 61_000);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(wrapper.get('[data-testid="freshness"]').text()).toBe(
      "Stale · updated 1 min ago",
    );
    expect(wrapper.get('[data-testid="freshness-state"]').text()).toBe("Stale");
    expect(wrapper.get('[data-testid="overview-body"]').classes()).toContain(
      "greyed",
    );
  });

  it("keeps the last good data, greyed, with a banner when a refresh fails", async () => {
    wrapper = mountPage();
    await settle();
    mocks.getOverview.mockReset().mockRejectedValue(httpError(500));
    await wrapper.get('[data-testid="refresh"]').trigger("click");
    await settle();

    expect(wrapper.get('[data-testid="error-banner"]').text()).toContain(
      "Could not refresh",
    );
    expect(wrapper.get('[data-testid="freshness"]').text()).toBe(
      "Update failed · showing data from just now",
    );
    expect(wrapper.get('[data-testid="freshness-state"]').text()).toBe(
      "Update failed",
    );
    expect(wrapper.get('[data-testid="overview-body"]').classes()).toContain(
      "greyed",
    );
    expect(wrapper.get('[data-testid="kpis"]').text()).toContain("78,701");
  });

  it("shows loading before the first answer", () => {
    mocks.getOverview
      .mockReset()
      .mockImplementation(() => new Promise(() => {}));
    wrapper = mountPage();
    expect(wrapper.get('[data-testid="freshness"]').text()).toBe(
      "Updated loading…",
    );
    expect(wrapper.find('[data-testid="kpis"]').exists()).toBe(false);
  });

  it("on an older backend shows the reduced view with a banner and no status parts", async () => {
    mocks.getOverview.mockReset().mockRejectedValue(httpError(404));
    mocks.loadLegacyOverview.mockResolvedValue({
      counts: {
        ...counts,
        users: { total: 25, delta: null, series: [] },
        repos: { total: 502, private: 71, delta: null, series: [] },
        commits: { total: 78701, delta: null, series: [] },
      },
      activity: {
        range: "30d",
        bucket: "day",
        labels: ["10-01"],
        commits: [5],
        repos: [1],
        users: [0],
      },
    });
    wrapper = mountPage();
    await settle();

    expect(wrapper.get('[data-testid="legacy-banner"]').text()).toContain(
      "predates the new overview API",
    );
    expect(wrapper.find('[data-testid="error-banner"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="kpis"]').text()).toContain("25");
    expect(wrapper.find('[data-testid="kpi-delta"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="chart"]').attributes("data-title")).toBe(
      "Activity · last 30d",
    );
    expect(wrapper.find('[data-testid="status-strip"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="attention"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="queue-card"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="recent-card"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="launch-card"]').exists()).toBe(true);
  });

  it("a failed section leaves a hole, not a broken page", async () => {
    const broken = { error: { code: "boom", message: "boom" } };
    mocks.getOverview.mockResolvedValue({
      ...FULL,
      sections: {
        ...FULL.sections,
        counts: broken,
        activity: broken,
        health: broken,
        queue: broken,
      },
    });
    wrapper = mountPage();
    await settle();

    expect(wrapper.find('[data-testid="kpis"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="chart"]').exists()).toBe(false);
    expect(
      wrapper.get('[data-testid="status-health-unavailable"]').exists(),
    ).toBe(true);
    expect(wrapper.get('[data-testid="queue-unavailable"]').exists()).toBe(
      true,
    );
    expect(wrapper.get('[data-testid="attention-quota"]').exists()).toBe(true);
  });
});
