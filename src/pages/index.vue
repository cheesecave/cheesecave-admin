<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AdminLayout from "@/components/AdminLayout.vue";
import AdminPage from "@/components/AdminPage.vue";
import AdminPageHeader from "@/components/AdminPageHeader.vue";
import ChartCard from "@/components/ChartCard.vue";
import AttentionList from "@/components/overview/AttentionList.vue";
import KpiTile from "@/components/overview/KpiTile.vue";
import QueueHealth from "@/components/overview/QueueHealth.vue";
import QuickLaunch from "@/components/overview/QuickLaunch.vue";
import RecentFeed from "@/components/overview/RecentFeed.vue";
import StatusStrip from "@/components/overview/StatusStrip.vue";
import TopRepos from "@/components/overview/TopRepos.vue";
import { useAdminStore } from "@/stores/admin";
import { useOverviewStore } from "@/stores/overview";
import { formatBytes } from "@/utils/api";
import { formatAge } from "@/utils/relative-time";

const router = useRouter();
const adminStore = useAdminStore();
const store = useOverviewStore();
const now = ref(Date.now());
let clock;

const RANGES = ["24h", "7d", "30d"];
const INTERVALS = [
  [15, "Refresh 15 s"],
  [30, "Refresh 30 s"],
  [60, "Refresh 1 min"],
  [0, "Manual"],
];

const sections = computed(() => store.sections);
const usable = (section) => (section && !section.error ? section : null);
const counts = computed(() => usable(sections.value.counts));
const n = (value) => Number(value).toLocaleString("en-US");

const age = computed(() =>
  store.lastOkAt === null
    ? "loading…"
    : formatAge(new Date(store.lastOkAt).toISOString(), now.value),
);
const stale = computed(() => store.isStale(now.value));
// Only a change of state is announced; the ticking "Updated … ago" label is not a live region.
const stateWord = computed(() =>
  store.failed ? "Update failed" : stale.value ? "Stale" : "",
);

const activity = computed(() => {
  const data = usable(sections.value.activity);
  if (!data) return null;
  return {
    labels: data.labels,
    datasets: [
      { label: "Commits", data: data.commits, borderColor: "#F56C6C", backgroundColor: "rgba(245,108,108,0.1)", fill: true, tension: 0.3 },
      { label: "New repositories", data: data.repos, borderColor: "#67C23A", backgroundColor: "rgba(103,194,58,0.1)", fill: true, tension: 0.3 },
    ],
  };
});

onMounted(() => {
  clock = setInterval(() => (now.value = Date.now()), 1000);
  if (!adminStore.token) {
    router.push("/login");
    return;
  }
  store.ensureStarted();
});
onBeforeUnmount(() => clearInterval(clock));
</script>

<template>
  <AdminLayout>
    <AdminPage>
      <AdminPageHeader title="Overview" subtitle="Is everything running, what needs you, and what is happening.">
        <template #actions>
          <div class="tools" data-testid="overview-tools">
            <span class="fresh" :class="{ stale, bad: store.failed }" data-testid="freshness">
              <i class="dot" aria-hidden="true" />
              <template v-if="store.failed">Update failed · showing data from {{ age }}</template>
              <template v-else-if="stale">Stale · updated {{ age }}</template>
              <template v-else>Updated {{ age }}</template>
            </span>
            <span class="sr-only" role="status" data-testid="freshness-state">{{ stateWord }}</span>
            <el-select :model-value="store.interval" size="small" style="width: 130px" aria-label="Auto-refresh" data-testid="interval" @update:model-value="store.setIntervalSeconds">
              <el-option v-for="[seconds, label] in INTERVALS" :key="seconds" :value="seconds" :label="label" />
            </el-select>
            <el-button size="small" aria-label="Refresh now" data-testid="refresh" @click="store.refresh()">
              <span class="i-carbon-renew" aria-hidden="true" />
            </el-button>
            <span class="seg" role="group" aria-label="Range">
              <button v-for="r in RANGES" :key="r" type="button" :class="{ on: store.range === r }" :aria-pressed="store.range === r" :data-testid="`range-${r}`" @click="store.setRange(r)">{{ r }}</button>
            </span>
          </div>
        </template>
      </AdminPageHeader>

      <el-alert v-if="store.legacy" type="warning" :closable="false" show-icon class="mb-4" data-testid="legacy-banner">
        <b>This backend predates the new overview API.</b> Showing the reduced view built from /stats; status, attention and queue need a newer backend.
      </el-alert>
      <el-alert v-else-if="store.failed" type="error" :closable="false" show-icon class="mb-4" data-testid="error-banner">
        <b>Could not refresh the overview.</b> The last good data stays on screen, greyed, and the next attempt is automatic.
      </el-alert>

      <div :class="{ greyed: store.failed || stale }" data-testid="overview-body">
        <template v-if="!store.legacy">
          <StatusStrip :health="sections.health" :workers="sections.workers" :queue="sections.queue" :build="sections.build" />
          <AttentionList :section="sections.attention" />
        </template>

        <div v-if="counts" class="kpis" data-testid="kpis">
          <KpiTile label="Users" :value="n(counts.users.total)" :sub="`${n(counts.orgs)} organizations`" :delta="counts.users.delta" :delta-label="store.range" :series="counts.users.series" to="/users" color="var(--color-user)" />
          <KpiTile label="Repositories" :value="n(counts.repos.total)" :sub="`${n(counts.repos.private)} private`" :delta="counts.repos.delta" :delta-label="store.range" :series="counts.repos.series" to="/repositories" color="var(--color-repo)" />
          <KpiTile label="Commits" :value="n(counts.commits.total)" :delta="counts.commits.delta" :delta-label="store.range" :series="counts.commits.series" to="/commits" color="var(--color-commit)" />
          <KpiTile label="Storage" :value="formatBytes(counts.storage.total)" :sub="`${formatBytes(counts.storage.private)} private · ${formatBytes(counts.storage.public)} public`" to="/storage" />
          <KpiTile label="LFS objects" :value="n(counts.lfs.objects)" :sub="formatBytes(counts.lfs.size)" to="/storage" />
        </div>

        <div class="two">
          <ChartCard v-if="activity" :title="`Activity · ${store.legacy ? 'last 30d' : 'last ' + store.range}`" :labels="activity.labels" :datasets="activity.datasets" :height="190" />
          <QueueHealth v-if="!store.legacy" :queue="sections.queue" />
        </div>
        <div v-if="!store.legacy" class="two">
          <RecentFeed :recent="sections.recent" :now="now" />
          <TopRepos :top="sections.top" />
        </div>
        <QuickLaunch :badges="store.badges" />
      </div>
    </AdminPage>
  </AdminLayout>
</template>

<style scoped>
.tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.fresh { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary, #6b7280); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-success); display: inline-block; }
.fresh.stale .dot { background: var(--color-warning); }
.fresh.bad .dot { background: var(--color-error); }
.seg button { border: 1px solid var(--border-default); background: var(--bg-card); color: var(--text-primary); padding: 2px 10px; font-size: 12px; cursor: pointer; }
.seg button:first-child { border-radius: 6px 0 0 6px; }
.seg button:last-child { border-radius: 0 6px 6px 0; }
.seg button + button { border-left: 0; }
.seg button.on { background: var(--color-info); color: #fff; border-color: var(--color-info); }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 16px; }
.two { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; margin-bottom: 16px; }
.greyed { opacity: 0.55; filter: grayscale(0.4); transition: opacity 0.2s; }
@media (max-width: 900px) { .two { grid-template-columns: minmax(0, 1fr); } }
</style>
