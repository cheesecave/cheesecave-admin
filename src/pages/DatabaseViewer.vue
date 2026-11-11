<script setup>
import { getApiErrorMessage } from "@/utils/api-error";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AdminLayout from "@/components/AdminLayout.vue";
import AdminPage from "@/components/AdminPage.vue";
import AdminPageHeader from "@/components/AdminPageHeader.vue";
import SqlEditor from "@/components/database/SqlEditor.vue";
import { useAdminStore } from "@/stores/admin";
import {
  executeDatabaseQuery,
  getDatabaseSchema,
  listDatabaseReports,
  runDatabaseReport,
} from "@/utils/api";
import { ElMessage } from "element-plus";

const router = useRouter();
const adminStore = useAdminStore();

const schema = ref(null);
const reports = ref({ categories: [], reports: [] });
const loading = ref(false);
const search = ref("");
const collapsed = ref({});
const selectedTable = ref(null);
const tab = ref("reports");
const selectedReport = ref(null);
const reportParams = ref({});
const queryText = ref("");
const result = ref(null);
const failure = ref(null); // { code, error }
const executing = ref(false);
const lastRun = ref(null); // { kind, id, sql } what "Show query plan" runs again
const history = ref([]);
const HISTORY_KEY = "cheesecave-admin-sql-history";

try {
  history.value = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
} catch {
  history.value = [];
}

const completionSchema = computed(() => {
  const out = {};
  for (const t of schema.value?.tables || []) {
    out[t.name] = t.columns.filter((c) => c.kind !== "credential").map((c) => c.name);
  }
  return out;
});

const visibleGroups = computed(() => {
  const needle = search.value.trim().toLowerCase();
  return (schema.value?.groups || [])
    .map((name) => ({
      name,
      tables: (schema.value.tables || []).filter(
        (t) =>
          t.group === name &&
          (!needle ||
            t.name.includes(needle) ||
            t.columns.some((c) => c.name.includes(needle))),
      ),
    }))
    .filter((g) => g.tables.length);
});

const reportsByCategory = computed(() =>
  reports.value.categories
    .map((name) => ({
      name,
      items: reports.value.reports.filter((r) => r.category === name),
    }))
    .filter((c) => c.items.length),
);

function formatCount(n) {
  if (n === null || n === undefined) return "";
  if (n < 0) return "not analysed";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} k`;
  return String(n);
}

function shortType(t) {
  return t
    .replace("character varying", "varchar")
    .replace("timestamp without time zone", "timestamp")
    .replace("timestamp with time zone", "timestamptz")
    .replace("double precision", "double");
}

function formatBytes(n) {
  if (n === null || n === undefined) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

function checkAuth() {
  if (!adminStore.token) {
    router.push("/login");
    return false;
  }
  return true;
}

async function load() {
  if (!checkAuth()) return;
  loading.value = true;
  try {
    [schema.value, reports.value] = await Promise.all([
      getDatabaseSchema(adminStore.token),
      listDatabaseReports(adminStore.token),
    ]);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, "Failed to load the database schema"));
  } finally {
    loading.value = false;
  }
}

function pickReport(report) {
  selectedReport.value = report;
  reportParams.value = Object.fromEntries(report.params.map((p) => [p.name, p.default]));
  tab.value = "reports";
  result.value = null;
  failure.value = null;
}

function pickTable(table) {
  selectedTable.value = table;
}

function previewTable(table) {
  const columns = table.columns
    .filter((c) => c.kind !== "credential")
    .map((c) => `"${c.name}"`)
    .join(", ");
  queryText.value = `SELECT ${columns}\nFROM "${table.name}"\nLIMIT 100`;
  tab.value = "query";
  run();
}

function remember(sql) {
  history.value = [sql, ...history.value.filter((s) => s !== sql)].slice(0, 15);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value));
  } catch {
    /* private window: the history is only a convenience */
  }
}

async function execute(kind, options = {}) {
  if (!checkAuth()) return;
  executing.value = true;
  failure.value = null;
  result.value = null;
  try {
    if (kind === "report") {
      lastRun.value = { kind, id: selectedReport.value.id };
      result.value = await runDatabaseReport(adminStore.token, selectedReport.value.id, reportParams.value, options);
    } else {
      if (!queryText.value.trim()) {
        ElMessage.warning("Please enter a SQL query");
        return;
      }
      lastRun.value = { kind, sql: queryText.value };
      result.value = await executeDatabaseQuery(adminStore.token, queryText.value, options);
      if (!options.explain) remember(queryText.value);
    }
  } catch (error) {
    const detail = error?.response?.data?.detail;
    failure.value = {
      code: detail?.code || "failed",
      error: detail?.error || getApiErrorMessage(error, "Query execution failed"),
    };
  } finally {
    executing.value = false;
  }
}

const run = () => execute("query");
const runReport = () => execute("report");
const explain = () => execute(lastRun.value?.kind === "report" ? "report" : "query", { explain: true });

function download(name, type, body) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const exporting = ref(false);
async function exportAs(format) {
  // Re-run with the export cap (10 000 rows) so a truncated display is not what gets saved.
  exporting.value = true;
  try {
    const options = { max_rows: 10000 };
    const full =
      lastRun.value.kind === "report"
        ? await runDatabaseReport(adminStore.token, lastRun.value.id, reportParams.value, options)
        : await executeDatabaseQuery(adminStore.token, lastRun.value.sql, options);
    if (format === "json") {
      download(`result_${Date.now()}.json`, "application/json", JSON.stringify(full.rows, null, 2));
    } else {
      const quote = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
      const csv = [full.columns.map(quote).join(","), ...full.rows.map((r) => full.columns.map((c) => quote(r[c])).join(","))].join("\n");
      download(`result_${Date.now()}.csv`, "text/csv", csv);
    }
    ElMessage.success(`Exported ${full.count} rows${full.truncated ? " (capped at 10 000)" : ""}`);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, "Export failed"));
  } finally {
    exporting.value = false;
  }
}

async function copyResult() {
  const text = [result.value.columns.join("\t"), ...result.value.rows.map((r) => result.value.columns.map((c) => r[c] ?? "").join("\t"))].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success("Copied as tab-separated text");
  } catch {
    ElMessage.warning("The browser refused to copy");
  }
}

const failureTitle = computed(
  () =>
    ({
      refused: "The viewer did not run this query",
      timeout: "The database stopped the query",
      parameters: "A report parameter is not valid",
    })[failure.value?.code] || "The database refused the query",
);

onMounted(load);
</script>

<template>
  <AdminLayout>
    <AdminPage>
      <AdminPageHeader
        title="Database"
        subtitle="The live schema, reports that ship with the backend, and a read-only SQL editor."
      />
      <div class="mb-4 flex flex-wrap items-center gap-2 text-sm" data-testid="database-read-only-notice">
        <el-tag type="warning" effect="plain">read-only transaction</el-tag>
        <el-tag type="info" effect="plain">10 s timeout</el-tag>
        <el-tag type="info" effect="plain">1000 rows shown, 10 000 exported</el-tag>
        <el-tag v-if="schema" type="success" effect="plain">{{ schema.engine }} · {{ schema.tables.length }} tables</el-tag>
      </div>

      <div class="db-grid">
        <aside class="db-side">
          <el-card v-loading="loading" shadow="never">
            <template #header>
              <div class="flex items-center gap-2">
                <div class="i-carbon-table text-blue-600" />
                <span class="font-bold">Schema</span>
              </div>
            </template>
            <el-input v-model="search" placeholder="Find a table or column" clearable size="small" class="mb-2" data-testid="schema-search" />
            <div
              v-if="schema && (schema.drift.tables_without_model.length || schema.drift.models_without_table.length || schema.drift.tables_without_group.length)"
              class="drift-note"
              data-testid="schema-drift"
            >
              <strong>Out of step:</strong>
              <span v-if="schema.drift.models_without_table.length">
                model without a table: {{ schema.drift.models_without_table.join(", ") }}.
              </span>
              <span v-if="schema.drift.tables_without_model.length">
                table without a model: {{ schema.drift.tables_without_model.join(", ") }}.
              </span>
              <span v-if="schema.drift.tables_without_group.length">no group: {{ schema.drift.tables_without_group.join(", ") }}.</span>
            </div>
            <div class="tables-list" role="region" aria-label="Database tables" tabindex="0">
              <div v-for="group in visibleGroups" :key="group.name" class="group">
                <button class="group-head" @click="collapsed[group.name] = !collapsed[group.name]">
                  <span :class="collapsed[group.name] ? 'i-carbon-chevron-right' : 'i-carbon-chevron-down'" />
                  {{ group.name }}
                  <span class="muted">{{ group.tables.length }}</span>
                </button>
                <template v-if="!collapsed[group.name]">
                  <div
                    v-for="table in group.tables"
                    :key="table.name"
                    class="table-item"
                    :class="{ selected: selectedTable?.name === table.name }"
                    :data-testid="`table-${table.name}`"
                    @click="pickTable(table)"
                  >
                    <span class="font-mono text-sm">{{ table.name }}</span>
                    <span class="muted">{{ formatCount(table.estimated_rows) }}</span>
                  </div>
                </template>
              </div>
            </div>
          </el-card>
        </aside>

        <main class="db-main">
          <el-card v-if="selectedTable" class="mb-4" shadow="never" data-testid="table-detail">
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span class="font-mono font-bold">{{ selectedTable.name }}</span>
                  <el-tag class="ml-2" size="small" effect="plain">{{ selectedTable.group }}</el-tag>
                  <el-tag v-if="!selectedTable.model" class="ml-1" size="small" type="warning">no model</el-tag>
                  <span class="muted ml-2">
                    {{ formatCount(selectedTable.estimated_rows) }} rows (estimate) · {{ formatBytes(selectedTable.total_bytes) }}
                  </span>
                </div>
                <div class="flex gap-2">
                  <el-button size="small" type="primary" @click="previewTable(selectedTable)">Preview 100 rows</el-button>
                  <el-button size="small" @click="selectedTable = null">Close</el-button>
                </div>
              </div>
              <div v-if="selectedTable.description" class="muted mt-1">{{ selectedTable.description }}</div>
            </template>
            <el-table :data="selectedTable.columns" size="small" max-height="560" border>
              <el-table-column label="Column" min-width="300">
                <template #default="{ row }">
                  <span class="font-mono">{{ row.name }}</span>
                  <el-tag v-if="row.primary_key" size="small" type="info" class="ml-1">PK</el-tag>
                  <el-tag v-if="row.kind === 'credential'" size="small" type="danger" class="ml-1">credential · never returned</el-tag>
                  <el-tag v-else-if="row.kind === 'pii'" size="small" type="warning" class="ml-1">personal data</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="Type" width="130">
                <template #default="{ row }">{{ shortType(row.type) }}</template>
              </el-table-column>
              <el-table-column label="Null" width="70">
                <template #default="{ row }">{{ row.null ? "yes" : "" }}</template>
              </el-table-column>
              <el-table-column label="References" min-width="150">
                <template #default="{ row }">
                  <a v-if="row.references" class="ref-link" @click="pickTable(schema.tables.find((t) => t.name === row.references.table))">
                    {{ row.references.table }}.{{ row.references.column }}
                  </a>
                </template>
              </el-table-column>
            </el-table>
            <div v-if="selectedTable.indexes.length" class="muted mt-2">
              Indexes:
              <span v-for="ix in selectedTable.indexes" :key="ix.name" class="ix">
                {{ ix.name }} ({{ ix.columns.join(", ") }}){{ ix.unique ? " unique" : "" }}
              </span>
            </div>
          </el-card>

          <el-card shadow="never">
            <el-tabs v-model="tab">
              <el-tab-pane label="Reports" name="reports">
                <div class="reports-grid">
                  <div class="reports-list" data-testid="reports-list">
                    <div v-for="cat in reportsByCategory" :key="cat.name" class="mb-3">
                      <div class="cat">{{ cat.name }}</div>
                      <div
                        v-for="r in cat.items"
                        :key="r.id"
                        class="report-item"
                        :class="{ selected: selectedReport?.id === r.id }"
                        :data-testid="`report-${r.id}`"
                        @click="pickReport(r)"
                      >
                        {{ r.title }}
                        <el-tag v-if="r.heavy" size="small" type="warning" effect="plain">heavy</el-tag>
                      </div>
                    </div>
                  </div>
                  <div class="report-form">
                    <el-empty v-if="!selectedReport" description="Pick a report" :image-size="80" />
                    <template v-else>
                      <h3 class="font-bold text-lg">{{ selectedReport.title }}</h3>
                      <p class="muted mb-3">{{ selectedReport.description }}</p>
                      <el-alert v-if="selectedReport.heavy" type="warning" :closable="false" show-icon class="mb-3" title="This report scans a big table: it can take a few seconds." />
                      <el-form label-position="top" class="params" @submit.prevent="runReport">
                        <el-form-item v-for="p in selectedReport.params" :key="p.name" :label="p.description">
                          <el-input-number v-if="p.type === 'int'" v-model="reportParams[p.name]" :min="p.min" :max="p.max" :data-testid="`param-${p.name}`" />
                          <el-select v-else-if="p.type === 'enum'" v-model="reportParams[p.name]">
                            <el-option v-for="c in p.choices" :key="c" :label="c" :value="c" />
                          </el-select>
                          <el-input v-else v-model="reportParams[p.name]" />
                        </el-form-item>
                      </el-form>
                      <el-button type="primary" :loading="executing" data-testid="run-report" @click="runReport">Run report</el-button>
                    </template>
                  </div>
                </div>
              </el-tab-pane>

              <el-tab-pane label="SQL editor" name="query">
                <SqlEditor v-model="queryText" :schema="completionSchema" @run="run" />
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <el-button type="primary" size="small" :loading="executing" data-testid="run-query" @click="run">Run (Ctrl+Enter)</el-button>
                  <el-button size="small" @click="queryText = ''">Clear</el-button>
                  <el-dropdown v-if="history.length" trigger="click" @command="(s) => (queryText = s)">
                    <el-button size="small">History ({{ history.length }})</el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item v-for="h in history" :key="h" :command="h">
                          <span class="history-item">{{ h.replace(/\s+/g, " ").slice(0, 80) }}</span>
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                  <span class="muted">Percent signs are fine. Writes, sleeping functions and credential columns are refused.</span>
                </div>
              </el-tab-pane>
            </el-tabs>
          </el-card>

          <el-alert
            v-if="failure"
            class="mt-4"
            :type="failure.code === 'timeout' ? 'warning' : 'error'"
            :title="failureTitle"
            :description="failure.error"
            show-icon
            :closable="false"
            :data-testid="`failure-${failure.code}`"
          />

          <el-card v-if="result" class="mt-4" shadow="never" data-testid="result-card">
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div v-if="result.plan">
                  <span class="font-bold">Query plan</span>
                  <el-tag class="ml-2" type="info">{{ result.elapsed_ms }} ms to plan</el-tag>
                </div>
                <div v-else>
                  <span class="font-bold">Result</span>
                  <el-tag class="ml-2" type="success">{{ result.count }} rows</el-tag>
                  <el-tag class="ml-1" type="info">{{ result.column_count }} columns</el-tag>
                  <el-tag class="ml-1" type="info">{{ result.elapsed_ms }} ms</el-tag>
                  <el-tag v-if="result.truncated" class="ml-1" type="warning" data-testid="truncated">
                    more rows exist: showing the first {{ result.row_limit }}
                  </el-tag>
                </div>
                <div v-if="!result.plan" class="flex gap-2">
                  <el-button size="small" @click="copyResult">Copy</el-button>
                  <el-button size="small" :loading="exporting" @click="exportAs('csv')">CSV</el-button>
                  <el-button size="small" :loading="exporting" @click="exportAs('json')">JSON</el-button>
                  <el-button size="small" @click="explain">Show query plan</el-button>
                </div>
                <el-button v-else size="small" @click="lastRun?.kind === 'report' ? runReport() : run()">Back to the rows</el-button>
              </div>
            </template>
            <pre v-if="result.plan" class="plan">{{ result.plan.join("\n") }}</pre>
            <el-empty v-else-if="result.count === 0" description="The query returned no rows" :image-size="80" />
            <el-table v-else :key="result.columns.join(',')" :data="result.rows" stripe border max-height="460" size="small">
              <el-table-column v-for="column in result.columns" :key="column" :prop="column" :label="column" min-width="130" show-overflow-tooltip>
                <template #default="{ row }">
                  <span :class="{ 'cell-null': row[column] === null }">{{ row[column] === null ? "NULL" : row[column] }}</span>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </main>
      </div>
    </AdminPage>
  </AdminLayout>
</template>

<style scoped>
.db-grid {
  display: grid;
  grid-template-columns: 290px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.db-side {
  position: sticky;
  top: 16px;
  min-width: 0;
}
.db-main {
  min-width: 0;
}
.tables-list {
  max-height: 560px;
  overflow-y: auto;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 2px;
  border: 0;
  background: none;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}
.table-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.table-item:hover {
  background: var(--el-fill-color-light);
}
.table-item.selected {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.drift-note {
  margin-bottom: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  font-size: 12px;
}
.reports-grid {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 20px;
}
.cat {
  margin-bottom: 4px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.report-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.report-item:hover {
  background: var(--el-fill-color-light);
}
.report-item.selected {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.ref-link {
  color: var(--el-color-primary);
  cursor: pointer;
}
.ix {
  display: inline-block;
  margin-right: 12px;
}
.plan {
  margin: 0;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
}
.cell-null {
  color: var(--el-text-color-placeholder);
  font-style: italic;
}
.history-item {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
@media (max-width: 900px) {
  .db-grid,
  .reports-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .db-side {
    position: static;
  }
}
</style>
