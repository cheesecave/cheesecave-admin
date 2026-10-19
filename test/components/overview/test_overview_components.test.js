import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ElementPlusStubs } from "../../helpers/vue";
import { RouterLinkStub, target } from "../../helpers/router";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("vue-router", () => ({ useRouter: () => router }));

import AttentionList from "@/components/overview/AttentionList.vue";
import KpiTile from "@/components/overview/KpiTile.vue";
import QueueHealth from "@/components/overview/QueueHealth.vue";
import QuickLaunch from "@/components/overview/QuickLaunch.vue";
import RecentFeed from "@/components/overview/RecentFeed.vue";
import StatusStrip from "@/components/overview/StatusStrip.vue";
import TopRepos from "@/components/overview/TopRepos.vue";

const render = (component, props) =>
  mount(component, {
    props,
    global: { stubs: { ...ElementPlusStubs, RouterLink: RouterLinkStub } },
  });
const ERROR = { error: { code: "boom", message: "boom" } };

describe("StatusStrip", () => {
  const health = {
    status: "degraded",
    dependencies: [
      { name: "postgres", status: "ok", latency_ms: 12, detail: null },
      { name: "lakefs", status: "down", latency_ms: null, detail: "timed out" },
      { name: "smtp", status: "disabled", latency_ms: null, detail: null },
    ],
  };

  it("shows each dependency with latency and the words for anything not ok", () => {
    const w = render(StatusStrip, {
      health,
      workers: { online: 3, lost: 1, draining: 0 },
      queue: { queued: 5, running: 1 },
      build: { backend: "3fd3765" },
    });

    const pg = w.get('[data-testid="status-dep-postgres"]');
    expect(pg.text()).toBe("postgres 12 ms");
    expect(target(pg)).toBe("/health");
    expect(pg.attributes("aria-label")).toBe("postgres: ok");
    const lake = w.get('[data-testid="status-dep-lakefs"]');
    expect(lake.text()).toBe("lakefs down");
    expect(lake.attributes("title")).toBe("timed out");
    expect(w.get('[data-testid="status-dep-smtp"]').text()).toBe(
      "smtp disabled",
    );
    expect(w.get('[data-testid="status-workers"]').text()).toBe(
      "Workers 3 online · 1 lost",
    );
    expect(target(w.get('[data-testid="status-workers"]'))).toBe("/tasks");
    expect(w.get('[data-testid="status-queue"]').text()).toBe(
      "Queue 5 queued · 1 running",
    );
    expect(w.get('[data-testid="status-build"]').text()).toBe(
      "backend 3fd3765",
    );
  });

  it("omits the lost count when no worker is lost", () => {
    const w = render(StatusStrip, {
      workers: { online: 2, lost: 0, draining: 0 },
    });
    expect(w.get('[data-testid="status-workers"]').text()).toBe(
      "Workers 2 online",
    );
  });

  it("says health is unavailable when that section failed, and hides failed sections", () => {
    const w = render(StatusStrip, {
      health: ERROR,
      workers: ERROR,
      queue: ERROR,
      build: ERROR,
    });
    expect(w.get('[data-testid="status-health-unavailable"]').exists()).toBe(
      true,
    );
    expect(w.find('[data-testid="status-workers"]').exists()).toBe(false);
    expect(w.find('[data-testid="status-queue"]').exists()).toBe(false);
    expect(w.find('[data-testid="status-build"]').exists()).toBe(false);
  });

  it("is empty while nothing has loaded", () => {
    const w = render(StatusStrip, {});
    expect(w.findAll("a")).toHaveLength(0);
    expect(w.find('[data-testid="status-health-unavailable"]').exists()).toBe(
      false,
    );
  });
});

describe("AttentionList", () => {
  const items = [
    {
      id: "tasks",
      severity: "danger",
      title: "2 tasks failed in the last 24 hours",
      count: 2,
      hint: "repo.recalc",
      link: {
        path: "/tasks",
        query: { status: "failed", window: "24h" },
        label: "Failed tasks",
      },
    },
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
    {
      id: "lfs_drift",
      severity: "info",
      title: "LFS drift",
      count: 1,
      hint: null,
      link: { path: "/storage", query: { tab: "lfs" }, label: "Storage" },
    },
  ];

  it("lists each item with its severity in words and a deep link", () => {
    const w = render(AttentionList, { section: { items } });
    const row = w.get('[data-testid="attention-tasks"]');
    expect(row.text()).toContain("danger:");
    expect(row.text()).toContain("2 tasks failed in the last 24 hours");
    expect(row.text()).toContain("repo.recalc");
    expect(row.text()).toContain("Failed tasks");
    expect(target(row)).toEqual({
      path: "/tasks",
      query: { status: "failed", window: "24h" },
    });
    expect(w.get('[data-testid="attention-quota"]').text()).not.toContain(
      "repo.recalc",
    );
    expect(w.get('[data-testid="attention-lfs_drift"]').text()).toContain(
      "info:",
    );
    expect(w.get("header").text()).toContain("3");
  });

  it("says all clear when nothing needs attention", () => {
    const w = render(AttentionList, { section: { items: [] } });
    expect(w.get('[data-testid="attention-clear"]').text()).toContain(
      "All clear",
    );
  });

  it("says the list is unavailable when the section failed", () => {
    const w = render(AttentionList, { section: ERROR });
    expect(w.get('[data-testid="attention-unavailable"]').exists()).toBe(true);
  });

  it("renders nothing before the section has loaded", () => {
    expect(
      render(AttentionList, {}).find('[data-testid="attention"]').exists(),
    ).toBe(false);
  });
});

describe("KpiTile", () => {
  it("shows the value, a signed delta and a trend, and links to its module", () => {
    const w = render(KpiTile, {
      label: "Commits",
      value: "78,701",
      delta: 1420,
      deltaLabel: "7d",
      series: [1, 5, 3],
      to: "/commits",
    });
    expect(target(w)).toBe("/commits");
    expect(w.get(".value").text()).toBe("78,701");
    expect(w.get('[data-testid="kpi-delta"]').text()).toBe("+1,420 / 7d");
    expect(w.get('[data-testid="kpi-delta"]').classes()).toContain("up");
    expect(w.get("polyline").attributes("points").split(" ")).toHaveLength(3);
    expect(w.find('[data-testid="kpi-sub"]').exists()).toBe(false);
  });

  it("shows a zero or negative delta without a plus and without the up colour", () => {
    const w = render(KpiTile, {
      label: "Users",
      value: "25",
      delta: 0,
      to: "/users",
    });
    expect(w.get('[data-testid="kpi-delta"]').text()).toBe("0 / 7d");
    expect(w.get('[data-testid="kpi-delta"]').classes()).not.toContain("up");
  });

  it("shows the subtitle after the delta when it has both", () => {
    const w = render(KpiTile, {
      label: "Users",
      value: "25",
      delta: 1,
      sub: "9 organizations",
      to: "/users",
    });
    expect(w.get(".foot").text()).toBe("+1 / 7d · 9 organizations");
  });

  it("falls back to the subtitle without a delta, and draws no trend for a flat or short series", () => {
    const w = render(KpiTile, {
      label: "Storage",
      value: "48 TB",
      sub: "6 TB private",
      series: [3],
      to: "/storage",
    });
    expect(w.find('[data-testid="kpi-delta"]').exists()).toBe(false);
    expect(w.text()).toContain("6 TB private");
    expect(w.find("svg").exists()).toBe(false);
    const flat = render(KpiTile, {
      label: "x",
      value: "1",
      series: [0, 0, 0],
      to: "/x",
    });
    expect(flat.find("polyline").exists()).toBe(true);
  });

  it("shows neither a delta nor a subtitle when it has none", () => {
    const w = render(KpiTile, { label: "x", value: "1", to: "/x" });
    expect(w.get(".foot").text()).toBe("");
  });
});

describe("QueueHealth", () => {
  const queue = {
    queued: 5,
    running: 1,
    succeeded_24h: 425,
    failed_24h: 2,
    oldest_queued_age_s: 9,
    hourly: [
      { ok: 3, failed: 0 },
      { ok: 60, failed: 2 },
    ],
  };

  it("shows the four counts as links into the filtered Tasks page", () => {
    const w = render(QueueHealth, { queue });
    expect(target(w.get('[data-testid="queue-queued"]'))).toEqual({
      path: "/tasks",
      query: { status: "queued" },
    });
    expect(target(w.get('[data-testid="queue-running"]'))).toEqual({
      path: "/tasks",
      query: { status: "running" },
    });
    expect(target(w.get('[data-testid="queue-succeeded"]'))).toEqual({
      path: "/tasks",
      query: { status: "succeeded", window: "24h" },
    });
    expect(target(w.get('[data-testid="queue-failed"]'))).toEqual({
      path: "/tasks",
      query: { status: "failed", window: "24h" },
    });
    expect(w.get('[data-testid="queue-failed"]').classes()).toContain("bad");
    expect(w.get('[data-testid="queue-oldest"]').text()).toBe(
      "Oldest queued: 9 s",
    );
    expect(
      w.get('[data-testid="queue-bars"]').attributes("aria-label"),
    ).toContain("last 24 hours");
    expect(w.findAll(".col")).toHaveLength(2);
    expect(w.findAll("i.fail")).toHaveLength(1);
  });

  it("is calm when nothing failed and nothing waits", () => {
    const w = render(QueueHealth, {
      queue: { ...queue, failed_24h: 0, oldest_queued_age_s: null, hourly: [] },
    });
    expect(w.get('[data-testid="queue-failed"]').classes()).not.toContain(
      "bad",
    );
    expect(w.get('[data-testid="queue-oldest"]').text()).toBe(
      "Nothing is waiting.",
    );
  });

  it("says so when the section failed, and shows only the frame before it loads", () => {
    expect(
      render(QueueHealth, { queue: ERROR })
        .find('[data-testid="queue-unavailable"]')
        .exists(),
    ).toBe(true);
    const loading = render(QueueHealth, {});
    expect(loading.find('[data-testid="queue-queued"]').exists()).toBe(false);
    expect(loading.find('[data-testid="queue-unavailable"]').exists()).toBe(
      false,
    );
  });
});

describe("RecentFeed", () => {
  const NOW = Date.parse("2026-10-19T12:00:00Z");
  const recent = {
    items: [
      {
        id: "user:1",
        kind: "user",
        actor: "mai_lin",
        text: "joined",
        at: "2026-10-19T11:48:00Z",
        link: "/users",
      },
      {
        id: "repo:2",
        kind: "repo",
        actor: "deepghs",
        text: "created dataset deepghs/x",
        at: "2026-10-19T09:00:00Z",
        link: "/repositories",
      },
      {
        id: "commit:3",
        kind: "commit",
        actor: "narugo",
        text: "committed “fix” to o/n",
        at: "2026-10-17T09:00:00Z",
        link: "/commits",
      },
    ],
  };

  it("shows who did what, how long ago, with an icon per kind and a link to the module", () => {
    const w = render(RecentFeed, { recent, now: NOW });
    const user = w.get('[data-testid="recent-user"]');
    expect(user.text()).toContain("mai_lin joined");
    expect(user.text()).toContain("12 min ago");
    expect(target(user)).toBe("/users");
    expect(user.get("span").classes()).toContain("i-carbon-user-follow");
    expect(w.get('[data-testid="recent-repo"]').text()).toContain("3 h ago");
    expect(w.get('[data-testid="recent-repo"] span').classes()).toContain(
      "i-carbon-data-base",
    );
    expect(w.get('[data-testid="recent-commit"]').text()).toContain("2 d ago");
    expect(w.get('[data-testid="recent-commit"] span').classes()).toContain(
      "i-carbon-version",
    );
  });

  it("handles empty, failed and not-yet-loaded", () => {
    expect(
      render(RecentFeed, { recent: { items: [] } })
        .find('[data-testid="recent-empty"]')
        .exists(),
    ).toBe(true);
    expect(
      render(RecentFeed, { recent: ERROR })
        .find('[data-testid="recent-unavailable"]')
        .exists(),
    ).toBe(true);
    expect(render(RecentFeed, {}).findAll("a")).toHaveLength(0);
  });

  it("uses the current time when none is passed", () => {
    const w = render(RecentFeed, {
      recent: { items: [{ ...recent.items[0], at: new Date().toISOString() }] },
    });
    expect(w.text()).toContain("just now");
  });
});

describe("TopRepos", () => {
  const top = {
    by_commits: [
      { repo_type: "dataset", repo_full_id: "deepghs/danbooru", commits: 5120 },
      { repo_type: "model", repo_full_id: "a/b", commits: 7 },
      { repo_type: "space", repo_full_id: "a/s", commits: 1 },
    ],
    by_size: [
      {
        repo_type: "dataset",
        repo_full_id: "deepghs/danbooru",
        size_bytes: 2_000_000_000_000,
      },
    ],
  };

  it("ranks by commits first and by size on request, linking to the repository search", async () => {
    const w = render(TopRepos, { top });
    const rows = w.findAll('[data-testid="top-row"]');
    expect(rows).toHaveLength(3);
    expect(rows[0].text()).toContain("deepghs/danbooru");
    expect(rows[0].text()).toContain("5,120 commits");
    expect(target(rows[0])).toEqual({
      path: "/repositories",
      query: { q: "deepghs/danbooru" },
    });
    expect(
      w.get('[data-testid="top-by-commits"]').attributes("aria-pressed"),
    ).toBe("true");

    await w.get('[data-testid="top-by-size"]').trigger("click");
    const sized = w.findAll('[data-testid="top-row"]');
    expect(sized).toHaveLength(1);
    expect(sized[0].text()).toContain("2 TB");
    expect(
      w.get('[data-testid="top-by-size"]').attributes("aria-pressed"),
    ).toBe("true");
    expect(
      w.get('[data-testid="top-by-commits"]').attributes("aria-pressed"),
    ).toBe("false");
  });

  it("handles failure and not-yet-loaded", () => {
    expect(
      render(TopRepos, { top: ERROR })
        .find('[data-testid="top-unavailable"]')
        .exists(),
    ).toBe(true);
    expect(
      render(TopRepos, {}).findAll('[data-testid="top-row"]'),
    ).toHaveLength(0);
  });
});

describe("QuickLaunch", () => {
  beforeEach(() => router.push.mockReset());

  it.each([
    ["Create user", { path: "/users", query: { create: "1" } }],
    ["Reset a password", { path: "/users", query: { reset: "1" } }],
    ["New invitation", { path: "/invitations", query: { create: "1" } }],
    ["Run LFS reconciliation", { path: "/storage", query: { tab: "lfs" } }],
  ])("the %s action opens its page prepared", async (label, to) => {
    const w = render(QuickLaunch, {});
    await w
      .findAll("button")
      .find((b) => b.text() === label)
      .trigger("click");
    expect(router.push).toHaveBeenCalledWith(to);
  });

  it("lists every module under its group, with a labelled badge where there is something to look at", () => {
    const w = render(QuickLaunch, {
      badges: {
        "/tasks": { n: 2, kind: "danger" },
        "/QuotaOverview": { n: 3, kind: "warning" },
      },
    });
    const links = w.findAll(".m").map((a) => target(a));
    expect(links).toEqual(
      expect.arrayContaining([
        "/users",
        "/repositories",
        "/tasks",
        "/health",
        "/site",
        "/DatabaseViewer",
        "/QuotaOverview",
        "/cache",
      ]),
    );
    const badge = w.get(".b.danger");
    expect(badge.text()).toBe("2");
    expect(badge.attributes("aria-label")).toBe("2 need attention");
    expect(w.get(".b.warning").text()).toBe("3");
    expect(w.findAll(".b")).toHaveLength(2);
  });
});
