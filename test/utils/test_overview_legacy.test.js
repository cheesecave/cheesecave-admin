import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getDetailedStats: vi.fn(),
  getTimeseriesStats: vi.fn(),
}));

vi.mock("@/utils/api", () => ({
  getDetailedStats: (...args) => api.getDetailedStats(...args),
  getTimeseriesStats: (...args) => api.getTimeseriesStats(...args),
}));

import { loadLegacyOverview } from "@/utils/overview-legacy";

const DETAIL = {
  users: { total: 25 },
  organizations: { total: 9 },
  repositories: { total: 502, private: 71 },
  commits: { total: 78701 },
  lfs: { total_objects: 1130994, total_size: 48 },
  storage: { total_used: 100, private_used: 40, public_used: 60 },
};

describe("loadLegacyOverview", () => {
  beforeEach(() => {
    api.getDetailedStats.mockReset().mockResolvedValue(DETAIL);
    api.getTimeseriesStats.mockReset().mockResolvedValue({
      users_by_day: { "2026-10-02": 1 },
      commits_by_day: { "2026-10-01": 5, "2026-10-02": 7 },
      repositories_by_day: {
        "2026-10-02": { model: 1, dataset: 2, space: 0 },
        "2026-10-03": { model: 0, dataset: 0, space: 1 },
      },
    });
  });

  it("builds the new section shapes from /stats/detailed and /stats/timeseries", async () => {
    const sections = await loadLegacyOverview("tok");

    expect(api.getDetailedStats).toHaveBeenCalledWith("tok");
    expect(api.getTimeseriesStats).toHaveBeenCalledWith("tok", 30);
    expect(sections.counts).toEqual({
      users: { total: 25, delta: null, series: [] },
      orgs: 9,
      repos: { total: 502, private: 71, delta: null, series: [] },
      commits: { total: 78701, delta: null, series: [] },
      storage: { total: 100, private: 40, public: 60 },
      lfs: { objects: 1130994, size: 48 },
    });
    expect(sections.activity).toEqual({
      range: "30d",
      bucket: "day",
      labels: ["10-01", "10-02", "10-03"],
      commits: [5, 7, 0],
      repos: [0, 3, 1],
      users: [0, 1, 0],
    });
  });

  it("copes with empty time series", async () => {
    api.getTimeseriesStats.mockResolvedValue({
      users_by_day: {},
      commits_by_day: {},
      repositories_by_day: {},
    });
    const sections = await loadLegacyOverview("tok");
    expect(sections.activity.labels).toEqual([]);
  });

  it("propagates a failure of either endpoint", async () => {
    api.getDetailedStats.mockRejectedValue(new Error("boom"));
    await expect(loadLegacyOverview("tok")).rejects.toThrow("boom");
  });
});
