import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: { token: "admin-token", logout: vi.fn() },
  getOverview: vi.fn(),
  loadLegacyOverview: vi.fn(),
}));

vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.admin }));
vi.mock("@/utils/api", () => ({
  getOverview: (...args) => mocks.getOverview(...args),
}));
vi.mock("@/utils/overview-legacy", () => ({
  loadLegacyOverview: (...args) => mocks.loadLegacyOverview(...args),
}));

import { TIER_A, useOverviewStore } from "@/stores/overview";

let visibility = "visible";
const response = (sections, extra = {}) => ({
  schema: 1,
  generated_at: "2026-10-19T12:00:00Z",
  range: "7d",
  sections,
  ...extra,
});
const httpError = (status) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status } });
const sectionsOf = (call) => mocks.getOverview.mock.calls[call][1].sections;

describe("overview store", () => {
  let store;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    mocks.admin.token = "admin-token";
    mocks.admin.logout.mockReset();
    mocks.getOverview
      .mockReset()
      .mockResolvedValue(response({ queue: { queued: 1 } }));
    mocks.loadLegacyOverview.mockReset().mockResolvedValue({
      counts: { users: { total: 1 } },
    });
    setActivePinia(createPinia());
    store = useOverviewStore();
  });
  afterEach(() => {
    store.stop();
    vi.useRealTimers();
  });

  it("loads every section on start and remembers when it succeeded", async () => {
    await store.start();

    expect(mocks.getOverview).toHaveBeenCalledWith("admin-token", {
      sections: undefined,
      range: "7d",
    });
    expect(store.sections.queue).toEqual({ queued: 1 });
    expect(store.generatedAt).toBe("2026-10-19T12:00:00Z");
    expect(store.lastOkAt).toBe(Date.now());
    expect(store.failed).toBe(false);
    expect(store.running).toBe(true);
  });

  it("does nothing without an admin token", async () => {
    mocks.admin.token = "";
    await store.ensureStarted();
    expect(mocks.getOverview).not.toHaveBeenCalled();
    expect(store.running).toBe(false);
  });

  it("ensureStarted starts once, however many pages ask", async () => {
    await store.ensureStarted();
    await store.ensureStarted();
    expect(mocks.getOverview).toHaveBeenCalledTimes(1);
  });

  it("polls only the status sections each tick and everything on the fifth", async () => {
    await store.start(30);
    for (let i = 0; i < 5; i += 1) await vi.advanceTimersByTimeAsync(30_000);

    expect(mocks.getOverview).toHaveBeenCalledTimes(6);
    for (let call = 1; call <= 4; call += 1) {
      expect(sectionsOf(call)).toEqual(TIER_A);
    }
    expect(sectionsOf(5)).toBeUndefined();
  });

  it("merges a partial refresh into what it already has", async () => {
    mocks.getOverview.mockResolvedValueOnce(
      response({ queue: { queued: 1 }, counts: { orgs: 9 } }),
    );
    await store.start(30);
    mocks.getOverview.mockResolvedValueOnce(response({ queue: { queued: 7 } }));
    await vi.advanceTimersByTimeAsync(30_000);

    expect(store.sections.queue).toEqual({ queued: 7 });
    expect(store.sections.counts).toEqual({ orgs: 9 });
  });

  it("does not poll while the tab is hidden, and refreshes when it comes back", async () => {
    await store.start(30);
    visibility = "hidden";
    await vi.advanceTimersByTimeAsync(90_000);
    expect(mocks.getOverview).toHaveBeenCalledTimes(1);

    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.getOverview).toHaveBeenCalledTimes(2);
    expect(sectionsOf(1)).toBeUndefined();
  });

  it("ignores visibilitychange to hidden and after stop", async () => {
    await store.start(30);
    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    visibility = "visible";
    store.stop();
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.getOverview).toHaveBeenCalledTimes(1);
  });

  it("never has two requests in flight", async () => {
    let release;
    mocks.getOverview
      .mockReset()
      .mockImplementation(() => new Promise((resolve) => (release = resolve)));
    const first = store.refresh();
    await store.refresh();
    expect(mocks.getOverview).toHaveBeenCalledTimes(1);
    release(response({}));
    await first;
    mocks.getOverview.mockReset().mockResolvedValue(response({}));
    await store.refresh();
    expect(mocks.getOverview).toHaveBeenCalledTimes(1);
  });

  it("keeps the last good data and backs off exponentially, capped at 4x, after failures", async () => {
    await store.start(30);
    mocks.getOverview.mockReset().mockRejectedValue(httpError(500));

    await vi.advanceTimersByTimeAsync(30_000);
    expect(store.failed).toBe(true);
    expect(store.sections.queue).toEqual({ queued: 1 });
    expect(mocks.getOverview).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(59_000);
    expect(mocks.getOverview).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000); // 60 s after the first failure
    expect(mocks.getOverview).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(120_000);
    expect(mocks.getOverview).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(120_000); // capped: 4x = 120 s, not 240 s
    expect(mocks.getOverview).toHaveBeenCalledTimes(4);

    mocks.getOverview.mockResolvedValue(response({ queue: { queued: 2 } }));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(store.failed).toBe(false);
    await vi.advanceTimersByTimeAsync(30_000); // back to the normal cadence
    expect(mocks.getOverview).toHaveBeenCalledTimes(6);
  });

  it("does not schedule polls in manual mode but still refreshes on demand", async () => {
    await store.start(0);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(mocks.getOverview).toHaveBeenCalledTimes(1);
    await store.refresh();
    expect(mocks.getOverview).toHaveBeenCalledTimes(2);
  });

  it("changing the interval reschedules, and switching to manual cancels", async () => {
    await store.start(30);
    store.setIntervalSeconds(15);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(mocks.getOverview).toHaveBeenCalledTimes(2);
    store.setIntervalSeconds(0);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(mocks.getOverview).toHaveBeenCalledTimes(2);
  });

  it("setIntervalSeconds before start does not start anything", () => {
    store.setIntervalSeconds(60);
    expect(store.interval).toBe(60);
    expect(store.running).toBe(false);
  });

  it("changing the range refetches the slower sections only", async () => {
    await store.start(30);
    await store.setRange("24h");
    expect(mocks.getOverview).toHaveBeenLastCalledWith("admin-token", {
      sections: ["counts", "recent", "activity", "top", "build"],
      range: "24h",
    });
    await store.setRange("24h"); // unchanged: no request
    expect(mocks.getOverview).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["404", httpError(404), null],
    ["an unknown schema", null, 2],
  ])("falls back to the reduced view on %s", async (_name, error, schema) => {
    if (error) mocks.getOverview.mockReset().mockRejectedValue(error);
    else
      mocks.getOverview.mockReset().mockResolvedValue(response({}, { schema }));
    await store.start(30);

    expect(store.legacy).toBe(true);
    expect(store.failed).toBe(false);
    expect(store.sections).toEqual({ counts: { users: { total: 1 } } });
    expect(store.lastOkAt).toBe(Date.now());
  });

  it("in the reduced view skips the status polls and re-checks the endpoint on the full refresh", async () => {
    mocks.getOverview.mockReset().mockRejectedValue(httpError(404));
    await store.start(30);
    for (let i = 0; i < 4; i += 1) await vi.advanceTimersByTimeAsync(30_000);
    expect(mocks.getOverview).toHaveBeenCalledTimes(1);

    mocks.getOverview
      .mockReset()
      .mockResolvedValue(response({ queue: { queued: 3 } }));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(store.legacy).toBe(false);
    expect(store.sections).toEqual({ queue: { queued: 3 } });
  });

  it("reports a failure when even the reduced view cannot be built", async () => {
    mocks.getOverview.mockReset().mockRejectedValue(httpError(404));
    mocks.loadLegacyOverview.mockRejectedValue(httpError(500));
    await store.start(30);
    expect(store.failed).toBe(true);
    expect(store.legacy).toBe(false);
  });

  it.each([401, 403])(
    "a %s means the session is over: stop and flag it",
    async (status) => {
      mocks.getOverview.mockReset().mockRejectedValue(httpError(status));
      await store.start(30);
      expect(store.unauthorized).toBe(true);
      expect(store.running).toBe(false);
      await vi.advanceTimersByTimeAsync(600_000);
      expect(mocks.getOverview).toHaveBeenCalledTimes(1);
    },
  );

  it("is stale after two intervals without a success, never in manual mode", async () => {
    await store.start(30);
    expect(store.isStale(Date.now() + 60_000)).toBe(false);
    expect(store.isStale(Date.now() + 60_001)).toBe(true);
    store.setIntervalSeconds(0);
    expect(store.isStale(Date.now() + 10 * 3600_000)).toBe(false);
  });

  it("is not stale before anything was loaded", () => {
    expect(store.isStale(Date.now() + 10 * 3600_000)).toBe(false);
  });

  it("reset forgets everything (logout)", async () => {
    await store.start(30);
    store.reset();
    expect(store.sections).toEqual({});
    expect(store.generatedAt).toBe(null);
    expect(store.lastOkAt).toBe(null);
    expect(store.running).toBe(false);
    expect(store.badges).toEqual({});
  });

  describe("sidebar badges", () => {
    const load = async (sections) => {
      mocks.getOverview.mockReset().mockResolvedValue(response(sections));
      await store.start(30);
    };
    it("is empty before anything is known", () => {
      expect(store.badges).toEqual({});
    });
    it("shows failed tasks in red, else the queue in blue", async () => {
      await load({ queue: { failed_24h: 2, queued: 5 } });
      expect(store.badges["/tasks"]).toEqual({ n: 2, kind: "danger" });
      await load({ queue: { failed_24h: 0, queued: 5 } });
      expect(store.badges["/tasks"]).toEqual({ n: 5, kind: "info" });
      await load({ queue: { failed_24h: 0, queued: 0 } });
      expect(store.badges["/tasks"]).toBeUndefined();
    });
    it("flags a dependency that is not ok", async () => {
      await load({ health: { status: "degraded" } });
      expect(store.badges["/health"]).toEqual({ n: "!", kind: "danger" });
      await load({ health: { status: "ok" } });
      expect(store.badges["/health"]).toBeUndefined();
    });
    it("counts quota and flags LFS drift from the attention items", async () => {
      await load({
        attention: {
          items: [
            { id: "quota", count: 3 },
            { id: "lfs_drift", count: 1 },
          ],
        },
      });
      expect(store.badges["/QuotaOverview"]).toEqual({ n: 3, kind: "warning" });
      expect(store.badges["/storage"]).toEqual({ n: "!", kind: "info" });
    });
    it("ignores a section that failed", async () => {
      await load({
        queue: { error: { code: "x", message: "y" } },
        health: { error: { code: "x", message: "y" } },
        attention: { error: { code: "x", message: "y" } },
      });
      expect(store.badges).toEqual({});
    });
  });
});
