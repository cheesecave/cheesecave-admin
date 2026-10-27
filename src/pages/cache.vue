<script setup>
import { getApiErrorMessage } from "@/utils/api-error";
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import AdminLayout from "@/components/AdminLayout.vue";
import AdminPage from "@/components/AdminPage.vue";
import AdminPageHeader from "@/components/AdminPageHeader.vue";
import ChartCard from "@/components/ChartCard.vue";
import { useAdminStore } from "@/stores/admin";
import { clearLocalCache, getCacheStats, resetCacheMetrics } from "@/utils/api";
import { ElMessage, ElMessageBox } from "element-plus";
import dayjs from "dayjs";

const router = useRouter();
const adminStore = useAdminStore();

const loading = ref(false);
const resetting = ref(false);
const clearing = ref(false);
const snapshot = ref(null);
const lastError = ref(null);
const lastSuccessAt = ref(null);
const instanceChanged = ref(false);
const refreshIntervalSeconds = ref(0);
let refreshTimer = null;
let disposed = false;

const REFRESH_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "Every 5 s", value: 5 },
  { label: "Every 15 s", value: 15 },
  { label: "Every 60 s", value: 60 },
];

// Prefer the backend's measured mode. Legacy labels keep older APIs usable
// during a rolling upgrade, without inferring Redis health from a client object.
const STATE_TAG = {
  enabled: { type: "success", label: "Enabled" },
  disabled: { type: "info", label: "Disabled" },
  degraded: { type: "warning", label: "Degraded" },
  unknown: { type: "warning", label: "Unknown" },
  redis: { type: "success", label: "Redis" },
  memory: { type: "warning", label: "In-process memory" },
};

const metrics = computed(() => snapshot.value?.metrics ?? null);
const memory = computed(() => snapshot.value?.memory ?? null);
const backend = computed(() => snapshot.value?.backend ?? null);
const backendReason = computed(() => {
  const reason = backend.value?.reason;
  if (!reason || reason === "connected") return "";
  return (
    {
      redis_not_configured: "Redis not configured",
      not_initialized: "Redis starting",
      configuration_error: "Redis configuration error",
    }[reason] || "Redis unavailable"
  );
});
const local = computed(() => snapshot.value?.local ?? null);
const processMemory = computed(() => snapshot.value?.process ?? null);
const canReset = computed(
  () =>
    Boolean(backend.value?.instance_id) || operationalState.value === "enabled",
);
const history = computed(() =>
  (snapshot.value?.history || [])
    .filter((sample) => Number.isFinite(sample.timestamp_ms))
    .slice(-120),
);
const chartLabels = computed(() =>
  history.value.map((sample) => dayjs(sample.timestamp_ms).format("HH:mm:ss")),
);
const localHitRate = computed(() => {
  const reads = (local.value?.hits || 0) + (local.value?.misses || 0);
  return reads ? (local.value.hits / reads) * 100 : null;
});
const byteUsage = computed(() =>
  capacity(local.value?.used_bytes, local.value?.max_bytes),
);
const entryUsage = computed(() =>
  capacity(local.value?.entries, local.value?.max_entries),
);
const pressure = computed(() =>
  Math.max(byteUsage.value || 0, entryUsage.value || 0),
);
const charts = computed(() =>
  [
    {
      title: "Local cache · KB",
      key: "used_bytes",
      divisor: 1024,
      color: "#409eff",
      limit: local.value?.max_bytes,
    },
    {
      title: "Cache entries",
      key: "entries",
      divisor: 1,
      color: "#67a33d",
      limit: local.value?.max_entries,
    },
    {
      title: "Process RSS · MB",
      key: "rss_bytes",
      divisor: 1048576,
      color: "#b080ce",
    },
  ].map((chart) => ({
    ...chart,
    datasets: [
      {
        label: chart.title,
        data: history.value.map((sample) =>
          sample[chart.key] == null ? null : sample[chart.key] / chart.divisor,
        ),
        borderColor: chart.color,
        backgroundColor: chart.color + "18",
        pointRadius: 1,
        borderWidth: 2,
        tension: 0.15,
        fill: true,
      },
      ...(chart.limit > 0
        ? [
            {
              label: "Limit",
              hidden: true,
              data: history.value.map(() => chart.limit / chart.divisor),
              borderColor: "#b1b3b8",
              borderDash: [5, 4],
              pointRadius: 0,
              borderWidth: 1,
            },
          ]
        : []),
    ],
  })),
);

function capacity(used, max) {
  return max > 0 && Number.isFinite(used) ? (used / max) * 100 : null;
}

function growth(key) {
  const points = history.value.filter((sample) => Number.isFinite(sample[key]));
  if (points.length < 2) return "—";
  const delta = points.at(-1)[key] - points[0][key];
  return `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${key === "entries" ? formatNumber(Math.abs(delta)) : formatBytes(Math.abs(delta))}`;
}

// Resolve the operational state from the snapshot. ``configured_enabled``
// is what the config says; ``client_initialized`` is whether the API
// process actually owns a live connection. Combined:
//   on + initialized = enabled
//   on + !initialized = degraded (silent fallback to source)
//   off = disabled (intentional)
const operationalState = computed(() => {
  if (backend.value)
    return STATE_TAG[backend.value.mode] ? backend.value.mode : "unknown";
  if (!metrics.value) return "unknown";
  if (!metrics.value.configured_enabled) return "disabled";
  return metrics.value.client_initialized ? "enabled" : "degraded";
});

const stateBadge = computed(() => STATE_TAG[operationalState.value]);

// Pivot per-namespace counters into a flat row table. Hits + misses make
// hit ratio actionable; errors flag misconfigurations or Valkey trouble
// without needing to read the logs.
const namespaceRows = computed(() => {
  if (!metrics.value) return [];
  const ns = new Set([
    ...Object.keys(metrics.value.hits || {}),
    ...Object.keys(metrics.value.misses || {}),
    ...Object.keys(metrics.value.errors || {}),
    ...Object.keys(metrics.value.set_count || {}),
    ...Object.keys(metrics.value.invalidate_count || {}),
  ]);
  return [...ns].sort().map((name) => {
    const hits = metrics.value.hits?.[name] ?? 0;
    const misses = metrics.value.misses?.[name] ?? 0;
    const errors = metrics.value.errors?.[name] ?? 0;
    const sets = metrics.value.set_count?.[name] ?? 0;
    const invalidates = metrics.value.invalidate_count?.[name] ?? 0;
    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total) * 100 : null;
    return { name, hits, misses, errors, sets, invalidates, hitRate, total };
  });
});

const totals = computed(() => {
  const rows = namespaceRows.value;
  const sum = rows.reduce(
    (acc, r) => {
      acc.hits += r.hits;
      acc.misses += r.misses;
      acc.errors += r.errors;
      return acc;
    },
    { hits: 0, misses: 0, errors: 0 },
  );
  const tot = sum.hits + sum.misses;
  return {
    ...sum,
    hitRate: tot > 0 ? (sum.hits / tot) * 100 : null,
    total: tot,
  };
});

function formatNumber(n) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat().format(n);
}

function formatBytes(n) {
  if (n === null || n === undefined) return "—";
  if (n < 1024) return `${formatNumber(n)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(2)} ${units[i]}`;
}

function formatPercentage(value) {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

function formatTimestamp(ms) {
  if (!ms) return "—";
  return dayjs(ms).format("YYYY-MM-DD HH:mm:ss");
}

function formatRunId(value) {
  if (!value) return "—";
  // Valkey run_ids are 40-char hex; show first 12 to stay readable.
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
}

function checkAuth() {
  if (!adminStore.token) {
    router.push("/login");
    return false;
  }
  return true;
}

function handleAuthError(error) {
  if (error.response?.status !== 401 && error.response?.status !== 403)
    return false;
  clearTimer();
  ElMessage.error("Invalid admin token. Please login again.");
  adminStore.logout();
  router.push("/login");
  return true;
}

async function loadStats({ silent = false } = {}) {
  if (disposed || loading.value || !checkAuth()) return;
  loading.value = true;
  try {
    const data = await getCacheStats(adminStore.token);
    if (disposed) return;
    const previousInstance = backend.value?.instance_id;
    instanceChanged.value = Boolean(
      previousInstance && data.backend?.instance_id !== previousInstance,
    );
    snapshot.value = data;
    lastSuccessAt.value = data.backend?.sampled_at_ms || Date.now();
    lastError.value = null;
  } catch (error) {
    if (disposed || handleAuthError(error)) return;
    const detail = getApiErrorMessage(error, "Failed to load cache stats", {
      preferRequestMessage: true,
    });
    lastError.value = detail;
    if (!silent) {
      ElMessage.error(detail);
    }
  } finally {
    loading.value = false;
  }
}

async function handleResetMetrics() {
  if (resetting.value || clearing.value || !checkAuth()) return;
  const instanceId = backend.value?.instance_id;
  resetting.value = true;
  try {
    await ElMessageBox.confirm(
      `Reset counters for ${instanceId || "this process"}? Cached entries remain available.`,
      "Reset cache metrics",
      {
        confirmButtonText: "Reset",
        cancelButtonText: "Cancel",
        type: "warning",
      },
    );
  } catch {
    resetting.value = false;
    return; // user cancelled
  }
  try {
    if (disposed) return;
    if (instanceId) await resetCacheMetrics(adminStore.token, instanceId);
    else await resetCacheMetrics(adminStore.token);
    if (disposed) return;
    ElMessage.success("Cache metric counters reset");
    await loadStats({ silent: true });
  } catch (error) {
    if (disposed || handleAuthError(error)) return;
    const detail = getApiErrorMessage(error, "Failed to reset cache metrics", {
      preferRequestMessage: true,
    });
    ElMessage.error(detail);
  } finally {
    resetting.value = false;
  }
}

async function handleClearLocal() {
  if (resetting.value || clearing.value || !checkAuth()) return;
  const instanceId = backend.value?.instance_id;
  if (!instanceId) return;
  clearing.value = true;
  try {
    await ElMessageBox.confirm(
      `Clear local cached entries in ${instanceId}? Redis and other processes are unaffected.`,
      "Clear local cache",
      {
        confirmButtonText: "Clear local cache",
        cancelButtonText: "Cancel",
        type: "warning",
      },
    );
  } catch {
    clearing.value = false;
    return;
  }
  try {
    if (disposed) return;
    const result = await clearLocalCache(adminStore.token, instanceId);
    if (disposed) return;
    ElMessage.success(`Cleared ${formatNumber(result.cleared)} local entries`);
    await loadStats({ silent: true });
  } catch (error) {
    if (disposed || handleAuthError(error)) return;
    ElMessage.error(
      getApiErrorMessage(error, "Failed to clear local cache", {
        preferRequestMessage: true,
      }),
    );
  } finally {
    clearing.value = false;
  }
}

function clearTimer() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

watch(refreshIntervalSeconds, (seconds) => {
  clearTimer();
  if (seconds > 0) {
    refreshTimer = setInterval(() => {
      if (!document.hidden && !resetting.value && !clearing.value)
        loadStats({ silent: true });
    }, seconds * 1000);
  }
});

onMounted(() => {
  loadStats();
});

onBeforeUnmount(() => {
  disposed = true;
  clearTimer();
});
</script>

<template>
  <AdminLayout>
    <AdminPage>
      <AdminPageHeader title="Cache">
        <template #actions>
          <el-select
            v-model="refreshIntervalSeconds"
            aria-label="Auto-refresh interval"
            class="refresh-select"
            placeholder="Auto-refresh"
          >
            <el-option
              v-for="option in REFRESH_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-button
            type="primary"
            :loading="loading"
            :disabled="resetting || clearing"
            @click="loadStats()"
            data-testid="cache-refresh"
          >
            <div class="i-carbon-renew mr-1" />
            Refresh
          </el-button>
          <el-button
            :loading="resetting"
            :disabled="!canReset || clearing || loading"
            @click="handleResetMetrics"
            data-testid="cache-reset-metrics"
          >
            <div class="i-carbon-reset mr-1" />
            Reset counters
          </el-button>
          <el-button
            :loading="clearing"
            :disabled="!backend?.instance_id || !local || resetting || loading"
            @click="handleClearLocal"
            data-testid="cache-clear-local"
          >
            <div class="i-carbon-trash-can mr-1" />
            Clear local cache
          </el-button>
        </template>
      </AdminPageHeader>

      <el-alert
        v-if="lastError"
        type="warning"
        :title="lastError"
        :closable="false"
        show-icon
        class="mb-4"
      />
      <p
        v-if="lastError && lastSuccessAt"
        class="sample-status"
        data-testid="cache-stale"
      >
        Last successful sample: {{ formatTimestamp(lastSuccessAt) }}
      </p>
      <p
        v-if="instanceChanged"
        class="sample-status"
        data-testid="cache-instance-change"
        role="status"
      >
        Process changed: <code>{{ formatRunId(backend?.instance_id) }}</code>
      </p>

      <!-- Top banner: operational state + memory at a glance -->
      <el-card
        v-if="metrics"
        shadow="never"
        class="mb-4 overall-banner"
        data-testid="cache-overall"
      >
        <div class="flex items-center gap-3 flex-wrap">
          <span class="font-semibold text-gray-700 dark:text-gray-200">
            Status
          </span>
          <el-tag :type="stateBadge.type" size="large" effect="dark">
            {{ stateBadge.label }}
          </el-tag>
          <span class="text-gray-500 dark:text-gray-400 text-sm">
            namespace
            <code>{{ metrics.namespace }}</code>
          </span>
          <span
            v-if="memory?.available"
            class="text-gray-500 dark:text-gray-400 text-sm"
          >
            · {{ memory.used_memory_human || formatBytes(memory.used_memory) }}
            used
            <span v-if="memory.maxmemory && memory.maxmemory > 0">
              / {{ memory.maxmemory_human || formatBytes(memory.maxmemory) }}
            </span>
          </span>
          <span
            v-if="memory?.available"
            class="text-gray-500 dark:text-gray-400 text-sm"
          >
            · policy
            <code>{{ memory.maxmemory_policy }}</code>
          </span>
          <span
            v-if="memory?.available && memory.evicted_keys !== undefined"
            class="text-gray-500 dark:text-gray-400 text-sm"
          >
            · evictions {{ formatNumber(memory.evicted_keys) }}
          </span>
          <el-tooltip
            v-if="memory?.available"
            content="Redis memory and evictions describe the shared Redis server, including other namespaces. Activity counters below belong to the sampled API process."
            placement="top"
          >
            <button class="info-button" aria-label="Redis metric scope">
              <span class="i-carbon-information" />
            </button>
          </el-tooltip>
        </div>
        <div v-if="backend" class="process-strip">
          <span>
            Process
            <el-tooltip :content="backend.instance_id" placement="top"
              ><code tabindex="0">{{
                formatRunId(backend.instance_id)
              }}</code></el-tooltip
            >
            · PID
            {{ backend.pid }}
            <el-tooltip
              content="Local cache, counters and history belong to this process. Other workers have separate caches and limits; this is not a fleet-wide total."
              placement="top"
            >
              <button class="info-button" aria-label="Process scope">
                <span class="i-carbon-information" />
              </button>
            </el-tooltip>
          </span>
          <span>Started {{ formatTimestamp(backend.started_at_ms) }}</span>
          <span>Sampled {{ formatTimestamp(lastSuccessAt) }}</span>
          <el-tooltip
            v-if="backendReason"
            :content="backend.reason.replaceAll('_', ' ')"
            placement="top"
            ><span tabindex="0">{{ backendReason }}</span></el-tooltip
          >
          <span v-if="backend.next_retry_at_ms"
            >Redis retry {{ formatTimestamp(backend.next_retry_at_ms) }}</span
          >
        </div>
      </el-card>

      <el-card
        v-if="local"
        shadow="never"
        class="mb-4"
        data-testid="cache-local"
      >
        <template #header>
          <div class="section-heading">
            <span class="font-semibold">Local cache</span>
            <el-tag
              v-if="pressure >= 80"
              :type="pressure >= 95 ? 'danger' : 'warning'"
              size="small"
            >
              {{ pressure >= 95 ? "Near capacity" : "Capacity pressure" }}
            </el-tag>
            <el-tooltip
              content="TTL expiration and LRU eviction bound entries and accounted bytes per process. Capacity pressure starts at 80%, near capacity at 95%; neither alone indicates a leak."
              placement="top"
            >
              <button class="info-button" aria-label="Cache capacity">
                <span class="i-carbon-information" />
              </button>
            </el-tooltip>
          </div>
        </template>
        <div class="capacity-grid">
          <section class="capacity-tile">
            <div class="metric-label">
              Accounted memory
              <el-tooltip
                content="Memory tracked by the cache's byte budget. This estimate is separate from total process RSS and does not include all Python allocator overhead."
                placement="top"
              >
                <button
                  class="info-button"
                  aria-label="Accounted memory definition"
                >
                  <span class="i-carbon-information" />
                </button>
              </el-tooltip>
            </div>
            <div class="metric-value">
              {{ formatBytes(local.used_bytes) }}
              <span>/ {{ formatBytes(local.max_bytes) }}</span>
            </div>
            <el-progress
              :percentage="Math.min(100, byteUsage || 0)"
              :show-text="false"
              :status="
                byteUsage >= 95
                  ? 'exception'
                  : byteUsage >= 80
                    ? 'warning'
                    : undefined
              "
            />
            <div class="metric-foot">
              <span>{{ formatPercentage(byteUsage) }} used</span
              ><span>Peak {{ formatBytes(local.peak_bytes) }}</span>
            </div>
          </section>
          <section class="capacity-tile">
            <div class="metric-label">Entries</div>
            <div class="metric-value">
              {{ formatNumber(local.entries) }}
              <span>/ {{ formatNumber(local.max_entries) }}</span>
            </div>
            <el-progress
              :percentage="Math.min(100, entryUsage || 0)"
              :show-text="false"
              :status="
                entryUsage >= 95
                  ? 'exception'
                  : entryUsage >= 80
                    ? 'warning'
                    : undefined
              "
            />
            <div class="metric-foot">
              <span>{{ formatPercentage(entryUsage) }} used</span
              ><span>Peak {{ formatNumber(local.peak_entries) }}</span>
            </div>
          </section>
          <section class="capacity-tile">
            <div class="metric-label">
              Process RSS
              <el-tooltip
                content="Resident memory of the entire API process, including application objects, libraries and allocators. Compare its trend with cache size; growth is a signal to investigate, not proof of a cache leak. Clearing cache may not immediately reduce RSS."
                placement="top"
              >
                <button class="info-button" aria-label="RSS definition">
                  <span class="i-carbon-information" />
                </button>
              </el-tooltip>
            </div>
            <div class="metric-value">
              {{ formatBytes(processMemory?.rss_bytes) }}
            </div>
            <div class="metric-foot">
              <span v-if="processMemory?.rss_bytes != null"
                >{{ growth("rss_bytes") }} in window</span
              ><span v-else>RSS is unavailable</span>
            </div>
          </section>
        </div>
        <dl class="cache-counters">
          <div>
            <dt>Hit rate</dt>
            <dd>{{ formatPercentage(localHitRate) }}</dd>
          </div>
          <div>
            <dt>Hits / misses</dt>
            <dd>
              {{ formatNumber(local.hits) }} / {{ formatNumber(local.misses) }}
            </dd>
          </div>
          <div>
            <dt>Writes</dt>
            <dd>{{ formatNumber(local.sets) }}</dd>
          </div>
          <div>
            <dt>LRU evictions</dt>
            <dd>{{ formatNumber(local.evictions) }}</dd>
          </div>
          <div>
            <dt>Expired</dt>
            <dd>{{ formatNumber(local.expirations) }}</dd>
          </div>
          <div>
            <dt>Oversized rejected</dt>
            <dd>{{ formatNumber(local.rejected_oversize) }}</dd>
          </div>
          <div>
            <dt>Clears</dt>
            <dd>{{ formatNumber(local.clears) }}</dd>
          </div>
          <div>
            <dt>Cleanup interval</dt>
            <dd>{{ formatNumber(local.cleanup_interval_seconds) }} s</dd>
          </div>
        </dl>
      </el-card>

      <section v-if="local" class="mb-4" data-testid="cache-trends">
        <div class="section-heading trend-heading">
          <h2>Memory trends</h2>
          <span class="sample-status" v-if="history.length"
            >{{ formatTimestamp(history[0].timestamp_ms) }} –
            {{ formatTimestamp(history.at(-1).timestamp_ms) }}</span
          >
          <el-tooltip
            content="The latest 120 server samples for the displayed process. History is replaced when requests reach a different worker. Enable auto-refresh to follow changes."
            placement="top"
          >
            <button class="info-button" aria-label="Trend scope">
              <span class="i-carbon-information" />
            </button>
          </el-tooltip>
        </div>
        <div v-if="history.length" class="trend-grid">
          <div v-for="chart in charts" :key="chart.key" class="trend-cell">
            <ChartCard
              :title="chart.title"
              :labels="chartLabels"
              :datasets="chart.datasets"
              :height="170"
            />
            <span class="trend-delta">Δ {{ growth(chart.key) }}</span>
          </div>
        </div>
        <el-empty v-else description="No samples yet" :image-size="64" />
      </section>

      <el-card
        v-if="local"
        shadow="never"
        class="mb-4"
        data-testid="cache-local-namespaces"
      >
        <template #header
          ><span class="font-semibold">Local cache by namespace</span></template
        >
        <el-table
          v-if="local.namespaces?.length"
          :data="local.namespaces"
          size="small"
        >
          <el-table-column prop="namespace" label="Namespace" min-width="180" />
          <el-table-column label="Entries" align="right" min-width="100"
            ><template #default="{ row }">{{
              formatNumber(row.entries)
            }}</template></el-table-column
          >
          <el-table-column
            label="Accounted memory"
            align="right"
            min-width="160"
            ><template #default="{ row }">{{
              formatBytes(row.used_bytes)
            }}</template></el-table-column
          >
        </el-table>
        <el-empty v-else description="Local cache is empty" :image-size="64" />
      </el-card>

      <!-- Bootstrap flush + singleflight summary -->
      <el-card
        v-if="metrics && (!backend || backend.redis_configured)"
        shadow="never"
        class="mb-4"
        data-testid="cache-bootstrap"
      >
        <template #header>
          <span class="font-semibold">Redis bootstrap</span>
        </template>
        <ul class="bootstrap-meta">
          <li>
            <span class="meta-label">Last flushed run_id</span>
            <span class="meta-value">
              <code>{{ formatRunId(metrics.last_flush_run_id) }}</code>
            </span>
          </li>
          <li>
            <span class="meta-label">Last flushed at</span>
            <span class="meta-value">
              {{ formatTimestamp(metrics.last_flush_at_ms) }}
            </span>
          </li>
          <li>
            <span class="meta-label">Keys flushed</span>
            <span class="meta-value">
              {{ formatNumber(metrics.last_flushed_keys) }}
            </span>
          </li>
          <li>
            <span class="meta-label">Singleflight contention</span>
            <span class="meta-value">
              {{ formatNumber(metrics.singleflight_contention) }}
            </span>
          </li>
        </ul>
      </el-card>

      <!-- Per-namespace counters -->
      <el-card
        shadow="never"
        v-loading="loading"
        data-testid="cache-namespace-table"
      >
        <template #header>
          <div class="flex items-center justify-between">
            <span class="font-semibold">Namespace activity</span>
            <span
              v-if="totals.total > 0"
              class="text-gray-500 dark:text-gray-400 text-sm"
            >
              total {{ formatNumber(totals.total) }} reads · hit rate
              {{ formatPercentage(totals.hitRate) }}
            </span>
          </div>
        </template>
        <el-table
          v-if="namespaceRows.length"
          :data="namespaceRows"
          stripe
          size="default"
        >
          <el-table-column prop="name" label="Namespace" width="180">
            <template #default="{ row }">
              <code>{{ row.name }}</code>
            </template>
          </el-table-column>
          <el-table-column label="Hits" align="right" width="120">
            <template #default="{ row }">
              {{ formatNumber(row.hits) }}
            </template>
          </el-table-column>
          <el-table-column label="Misses" align="right" width="120">
            <template #default="{ row }">
              {{ formatNumber(row.misses) }}
            </template>
          </el-table-column>
          <el-table-column label="Hit rate" align="right" width="120">
            <template #default="{ row }">
              {{ formatPercentage(row.hitRate) }}
            </template>
          </el-table-column>
          <el-table-column label="Sets" align="right" width="120">
            <template #default="{ row }">
              {{ formatNumber(row.sets) }}
            </template>
          </el-table-column>
          <el-table-column label="Invalidates" align="right" width="140">
            <template #default="{ row }">
              {{ formatNumber(row.invalidates) }}
            </template>
          </el-table-column>
          <el-table-column label="Errors" align="right" width="120">
            <template #default="{ row }">
              <el-tag
                v-if="row.errors > 0"
                type="danger"
                size="small"
                effect="light"
              >
                {{ formatNumber(row.errors) }}
              </el-tag>
              <span v-else>0</span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else-if="!loading" description="No traffic recorded yet" />
      </el-card>
    </AdminPage>
  </AdminLayout>
</template>

<style scoped>
.refresh-select {
  width: 160px;
}

.process-strip,
.section-heading,
.metric-label,
.metric-foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.process-strip {
  margin-top: 14px;
  gap: 8px 20px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.process-strip code {
  overflow-wrap: anywhere;
}
.info-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  color: var(--el-text-color-secondary);
  background: transparent;
  border: 0;
  cursor: help;
  vertical-align: middle;
}
.info-button span {
  display: inline-block;
  width: 14px;
  height: 14px;
}
.capacity-grid,
.trend-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}
.capacity-tile {
  min-width: 0;
}
.metric-label,
.sample-status {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.metric-value {
  margin: 10px 0 14px;
  font-size: 26px;
  font-weight: 650;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.metric-value > span {
  font-size: 14px;
  font-weight: normal;
  color: var(--el-text-color-secondary);
}
.metric-foot {
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.cache-counters {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 12px;
  margin: 22px 0 0;
  padding-top: 18px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.cache-counters dt {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.cache-counters dd {
  margin: 6px 0 0;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.trend-heading {
  margin-bottom: 12px;
}
.trend-heading h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.trend-cell {
  position: relative;
  min-width: 0;
}
.trend-delta {
  position: absolute;
  top: 22px;
  right: 20px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.trend-cell :deep(.el-card__header) {
  padding-right: 120px;
}
.trend-cell :deep(.el-card) {
  box-shadow: none;
}
@container (max-width: 1100px) {
  .cache-counters {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@container (max-width: 760px) {
  .capacity-grid,
  .trend-grid {
    grid-template-columns: 1fr;
  }
  .capacity-tile + .capacity-tile {
    padding-top: 14px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
  .cache-counters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.bootstrap-meta {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.bootstrap-meta li {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.meta-value {
  font-size: 14px;
  color: var(--el-text-color-primary);
}
</style>
