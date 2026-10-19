import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getOverview, getDetailedStats, getTimeseriesStats } from "@/utils/api";

// Prototype. Tier A (health, queue, workers, attention) is polled; B and C ride along on a slower cadence.
export const TIER_A = ["health", "workers", "queue", "attention"];

export const useOverviewStore = defineStore("overview", () => {
  const sections = ref({});
  const generatedAt = ref(null);
  const failed = ref(false);
  const legacy = ref(false);
  const range = ref("7d");
  let timer = null;

  async function load(token, only) {
    try {
      const data = await getOverview(token, { sections: only, range: range.value });
      sections.value = { ...sections.value, ...data.sections };
      generatedAt.value = data.generated_at;
      failed.value = false;
      legacy.value = false;
    } catch (error) {
      if (error.response?.status === 404) {
        // an older backend: compose a reduced overview from the endpoints that always existed
        const [detail, series] = await Promise.all([getDetailedStats(token), getTimeseriesStats(token, 30)]);
        sections.value = { legacy: { detail, series } };
        generatedAt.value = new Date().toISOString();
        legacy.value = true;
        failed.value = false;
      } else {
        failed.value = true;
      }
    }
  }

  function start(token, seconds = 30) {
    stop();
    load(token);
    timer = setInterval(() => {
      if (document.visibilityState === "visible") load(token, TIER_A);
    }, seconds * 1000);
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  const badges = computed(() => {
    const q = sections.value.queue;
    const att = sections.value.attention?.items ?? [];
    const h = sections.value.health;
    return {
      "/tasks": q ? (q.failed_24h ? { n: q.failed_24h, kind: "danger" } : q.queued ? { n: q.queued, kind: "info" } : null) : null,
      "/health": h && h.status !== "ok" ? { n: "!", kind: "danger" } : null,
      "/QuotaOverview": att.find((a) => a.id === "quota") ? { n: att.find((a) => a.id === "quota").count, kind: "warning" } : null,
      "/storage": att.find((a) => a.id === "orphans") ? { n: att.find((a) => a.id === "orphans").count, kind: "info" } : null,
    };
  });

  return { sections, generatedAt, failed, legacy, range, load, start, stop, badges };
});
