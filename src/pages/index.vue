<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import AdminLayout from "@/components/AdminLayout.vue";
import AdminPage from "@/components/AdminPage.vue";
import AdminPageHeader from "@/components/AdminPageHeader.vue";
import ChartCard from "@/components/ChartCard.vue";
import StatusStrip from "@/components/overview/StatusStrip.vue";
import AttentionList from "@/components/overview/AttentionList.vue";
import KpiTile from "@/components/overview/KpiTile.vue";
import QueueHealth from "@/components/overview/QueueHealth.vue";
import RecentFeed from "@/components/overview/RecentFeed.vue";
import TopRepos from "@/components/overview/TopRepos.vue";
import QuickLaunch from "@/components/overview/QuickLaunch.vue";
import { useAdminStore } from "@/stores/admin";
import { useOverviewStore } from "@/stores/overview";
import { formatBytes } from "@/utils/api";

const router = useRouter();
const adminStore = useAdminStore();
const store = useOverviewStore();
const interval = ref(30);
const now = ref(Date.now());
let tick;

const s = computed(() => store.sections);
const n = (v) => Number(v || 0).toLocaleString("en-US");
const ageSeconds = computed(() => (store.generatedAt ? Math.max(0, Math.round((now.value - Date.parse(store.generatedAt)) / 1000)) : null));
const stale = computed(() => interval.value > 0 && ageSeconds.value != null && ageSeconds.value > interval.value * 2 + 5);
const updated = computed(() => (ageSeconds.value == null ? "loading…" : ageSeconds.value < 5 ? "just now" : `${ageSeconds.value} s ago`));

const activity = computed(() => {
  const a = s.value.activity;
  if (!a || a.error) return null;
  return {
    labels: a.labels,
    datasets: [
      { label: "Commits", data: a.commits, borderColor: "#F56C6C", backgroundColor: "rgba(245,108,108,.1)", fill: true, tension: 0.3 },
      { label: "New repositories", data: a.repos, borderColor: "#67C23A", backgroundColor: "rgba(103,194,58,.1)", fill: true, tension: 0.3 },
    ],
  };
});
const legacyCommits = computed(() => {
  const ts = s.value.legacy?.series?.commits_by_day;
  if (!ts) return null;
  const d = Object.keys(ts).sort();
  return { labels: d, datasets: [{ label: "Commits", data: d.map((k) => ts[k]), borderColor: "#F56C6C", backgroundColor: "rgba(245,108,108,.1)", fill: true, tension: 0.3 }] };
});

function restart() {
  if (!adminStore.token) return router.push("/login");
  store.start(adminStore.token, interval.value || 3600);
}
onMounted(() => { restart(); tick = setInterval(() => (now.value = Date.now()), 1000); });
onBeforeUnmount(() => { store.stop(); clearInterval(tick); });
watch(interval, restart);
watch(() => store.range, () => store.load(adminStore.token));
</script>

<template>
  <AdminLayout>
    <AdminPage>
      <AdminPageHeader title="Overview" subtitle="Is everything running, what needs you, and what is happening.">
        <template #actions>
        <div class="tools" data-testid="overview-tools">
          <span class="fresh" :class="{ stale, bad: store.failed }" data-testid="freshness">
            <i class="dot" />
            <template v-if="store.failed">Update failed · showing data from {{ updated }}</template>
            <template v-else-if="stale">Stale · updated {{ updated }}</template>
            <template v-else>Updated {{ updated }}</template>
          </span>
          <el-select v-model="interval" size="small" style="width: 130px" aria-label="Auto-refresh">
            <el-option :value="15" label="Refresh 15 s" /><el-option :value="30" label="Refresh 30 s" /><el-option :value="60" label="Refresh 1 min" /><el-option :value="0" label="Manual" />
          </el-select>
          <el-button size="small" aria-label="Refresh now" @click="store.load(adminStore.token)"><span class="i-carbon-renew" /></el-button>
          <el-radio-group v-model="store.range" size="small" aria-label="Range"><el-radio-button value="24h">24 h</el-radio-button><el-radio-button value="7d">7 d</el-radio-button><el-radio-button value="30d">30 d</el-radio-button></el-radio-group>
        </div>
        </template>
      </AdminPageHeader>

      <!-- Older backend: only the pre-overview endpoints exist -->
      <template v-if="store.legacy">
        <el-alert type="warning" :closable="false" class="mb-4" show-icon title="This backend predates the new overview API" description="Showing the reduced view built from /stats. Status, attention and queue need a newer backend." data-testid="legacy-banner" />
        <div class="kpis">
          <KpiTile label="Users" :value="n(s.legacy.detail.users.total)" :sub="`${s.legacy.detail.organizations.total} organizations`" to="/users" />
          <KpiTile label="Repositories" :value="n(s.legacy.detail.repositories.total)" :sub="`${s.legacy.detail.repositories.private} private`" to="/repositories" />
          <KpiTile label="Commits" :value="n(s.legacy.detail.commits.total)" to="/commits" />
          <KpiTile label="Storage" :value="formatBytes(s.legacy.detail.storage.total_used)" to="/storage" />
          <KpiTile label="LFS objects" :value="n(s.legacy.detail.lfs.total_objects)" :sub="formatBytes(s.legacy.detail.lfs.total_size)" to="/storage" />
        </div>
        <ChartCard v-if="legacyCommits" title="Commit activity (30 days)" :labels="legacyCommits.labels" :datasets="legacyCommits.datasets" :height="200" />
      </template>

      <template v-else>
        <el-alert v-if="store.failed" type="error" :closable="false" show-icon class="mb-4" title="Could not refresh the overview" description="The last good data stays on screen, greyed. Retrying on the next tick." data-testid="error-banner" />
        <div :class="{ greyed: store.failed || stale }">
          <StatusStrip :health="s.health" :workers="s.workers" :queue="s.queue" :build="s.build" />
          <AttentionList :items="s.attention?.items ?? s.attention ?? []" />

          <div v-if="s.counts && !s.counts.error" class="kpis" data-testid="kpis">
            <KpiTile label="Users" :value="n(s.counts.users.total)" :delta="s.counts.users.delta" :deltaLabel="store.range" :series="s.counts.users.series" to="/users" color="var(--color-user)" />
            <KpiTile label="Repositories" :value="n(s.counts.repos.total)" :delta="s.counts.repos.delta" :deltaLabel="store.range" :series="s.counts.repos.series" to="/repositories" color="var(--color-repo)" />
            <KpiTile label="Commits" :value="n(s.counts.commits.total)" :delta="s.counts.commits.delta" :deltaLabel="store.range" :series="s.counts.commits.series" to="/commits" color="var(--color-commit)" />
            <KpiTile label="Storage" :value="formatBytes(s.counts.storage.total)" :sub="`${formatBytes(s.counts.storage.private)} private · ${formatBytes(s.counts.storage.public)} public`" to="/storage" />
            <KpiTile label="LFS objects" :value="n(s.counts.lfs.objects)" :sub="formatBytes(s.counts.lfs.size)" to="/storage" />
          </div>

          <div class="two">
            <ChartCard v-if="activity" :title="`Activity · last ${store.range}`" :labels="activity.labels" :datasets="activity.datasets" :height="190" />
            <QueueHealth :queue="s.queue" />
          </div>
          <div class="two">
            <RecentFeed :recent="s.recent" />
            <TopRepos :top="s.top" />
          </div>
          <QuickLaunch :badges="store.badges" />
        </div>
      </template>
    </AdminPage>
  </AdminLayout>
</template>

<style scoped>
.tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.fresh { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary, #6b7280); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-success); display: inline-block; }
.fresh.stale .dot { background: var(--color-warning); } .fresh.bad .dot { background: var(--color-error); }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 16px; }
.two { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; margin-bottom: 16px; }
.greyed { opacity: .55; filter: grayscale(.4); transition: opacity .2s; }
@media (max-width: 900px) { .two { grid-template-columns: minmax(0, 1fr); } }
</style>
