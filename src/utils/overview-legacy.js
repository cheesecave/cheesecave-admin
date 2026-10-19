import { getDetailedStats, getTimeseriesStats } from "@/utils/api";

const sum = (counts) => Object.values(counts || {}).reduce((a, b) => a + b, 0);

/**
 * The reduced Overview for a backend that predates GET /overview: the same `counts` and `activity`
 * shapes, built from the endpoints that always existed. No deltas or sparklines (the old API has
 * no per-range creation counts), and none of the status sections.
 */
export async function loadLegacyOverview(token) {
  const [detail, series] = await Promise.all([
    getDetailedStats(token),
    getTimeseriesStats(token, 30),
  ]);
  const days = [
    ...new Set([
      ...Object.keys(series.users_by_day),
      ...Object.keys(series.commits_by_day),
      ...Object.keys(series.repositories_by_day),
    ]),
  ].sort();
  return {
    counts: {
      users: { total: detail.users.total, delta: null, series: [] },
      orgs: detail.organizations.total,
      repos: {
        total: detail.repositories.total,
        private: detail.repositories.private,
        delta: null,
        series: [],
      },
      commits: { total: detail.commits.total, delta: null, series: [] },
      storage: {
        total: detail.storage.total_used,
        private: detail.storage.private_used,
        public: detail.storage.public_used,
      },
      lfs: { objects: detail.lfs.total_objects, size: detail.lfs.total_size },
    },
    activity: {
      range: "30d",
      bucket: "day",
      labels: days.map((d) => d.slice(5)),
      commits: days.map((d) => series.commits_by_day[d] || 0),
      repos: days.map((d) => sum(series.repositories_by_day[d])),
      users: days.map((d) => series.users_by_day[d] || 0),
    },
  };
}
