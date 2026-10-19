import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useAdminStore } from "@/stores/admin";
import { getOverview } from "@/utils/api";
import { loadLegacyOverview } from "@/utils/overview-legacy";

// Status sections are cheap and time-critical: polled every interval. The rest (counts, feed, charts)
// ride along on every FULL_EVERY-th tick and whenever the range changes.
export const TIER_A = ["health", "workers", "queue", "attention"];
export const TIER_B = ["counts", "recent", "activity", "top", "build"];
const FULL_EVERY = 5;
const MAX_BACKOFF = 4;
const SCHEMA = 1;

const usable = (section) => (section && !section.error ? section : null);

export const useOverviewStore = defineStore("overview", () => {
  const admin = useAdminStore();
  const sections = ref({});
  const generatedAt = ref(null);
  const lastOkAt = ref(null);
  const failed = ref(false);
  const legacy = ref(false);
  const unauthorized = ref(false);
  const running = ref(false);
  const range = ref("7d");
  const interval = ref(30);
  let timer = null;
  let inflight = false;
  let failures = 0;
  let ticks = 0;

  function succeeded(next, serverTime) {
    sections.value = next;
    generatedAt.value = serverTime;
    lastOkAt.value = Date.now();
    failed.value = false;
    failures = 0;
  }

  async function fallBackToLegacy() {
    try {
      succeeded(
        await loadLegacyOverview(admin.token),
        new Date().toISOString(),
      );
      legacy.value = true;
    } catch {
      failed.value = true;
      failures += 1;
    }
  }

  async function refresh(only) {
    if (inflight || !admin.token) return;
    inflight = true;
    try {
      const data = await getOverview(admin.token, {
        sections: only,
        range: range.value,
      });
      if (data.schema !== SCHEMA) {
        await fallBackToLegacy();
        return;
      }
      const base = legacy.value ? {} : sections.value;
      succeeded({ ...base, ...data.sections }, data.generated_at);
      legacy.value = false;
    } catch (error) {
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        unauthorized.value = true;
        stop();
      } else if (status === 404) {
        await fallBackToLegacy();
      } else {
        failed.value = true;
        failures += 1;
      }
    } finally {
      inflight = false;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!running.value || interval.value <= 0) return;
    const delay = interval.value * 1000 * Math.min(MAX_BACKOFF, 2 ** failures);
    timer = setTimeout(tick, delay);
  }

  async function tick() {
    timer = null;
    if (document.visibilityState === "visible") {
      ticks += 1;
      const full = ticks % FULL_EVERY === 0;
      // the reduced view has no status sections to poll; the full refresh re-checks the endpoint
      if (!legacy.value || full) await refresh(full ? undefined : TIER_A);
    }
    schedule();
  }

  function onVisible() {
    if (running.value && document.visibilityState === "visible") {
      refresh().then(schedule);
    }
  }

  async function start(seconds = interval.value) {
    interval.value = seconds;
    running.value = true;
    unauthorized.value = false;
    ticks = 0;
    failures = 0;
    document.addEventListener("visibilitychange", onVisible);
    await refresh();
    schedule();
  }

  async function ensureStarted() {
    if (!running.value && admin.token) await start();
  }

  function stop() {
    running.value = false;
    clearTimeout(timer);
    timer = null;
    document.removeEventListener("visibilitychange", onVisible);
  }

  function reset() {
    stop();
    sections.value = {};
    generatedAt.value = null;
    lastOkAt.value = null;
    failed.value = false;
    legacy.value = false;
    unauthorized.value = false;
  }

  function setIntervalSeconds(seconds) {
    interval.value = seconds;
    schedule();
  }

  async function setRange(next) {
    if (next === range.value) return;
    range.value = next;
    await refresh(TIER_B);
  }

  // Stale: no success for two intervals. In manual mode nothing is expected, so nothing is stale.
  function isStale(now) {
    return (
      interval.value > 0 &&
      lastOkAt.value !== null &&
      now - lastOkAt.value > 2 * interval.value * 1000
    );
  }

  const badges = computed(() => {
    const out = {};
    const queue = usable(sections.value.queue);
    if (queue?.failed_24h)
      out["/tasks"] = { n: queue.failed_24h, kind: "danger" };
    else if (queue?.queued) out["/tasks"] = { n: queue.queued, kind: "info" };
    const health = usable(sections.value.health);
    if (health && health.status !== "ok")
      out["/health"] = { n: "!", kind: "danger" };
    const items = usable(sections.value.attention)?.items ?? [];
    const quota = items.find((item) => item.id === "quota");
    if (quota) out["/QuotaOverview"] = { n: quota.count, kind: "warning" };
    if (items.some((item) => item.id === "lfs_drift")) {
      out["/storage"] = { n: "!", kind: "info" };
    }
    return out;
  });

  return {
    sections,
    generatedAt,
    lastOkAt,
    failed,
    legacy,
    unauthorized,
    running,
    range,
    interval,
    badges,
    refresh,
    start,
    ensureStarted,
    stop,
    reset,
    setIntervalSeconds,
    setRange,
    isStale,
  };
});
