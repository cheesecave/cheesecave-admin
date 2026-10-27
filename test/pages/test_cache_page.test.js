import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
  adminStore: {
    token: "admin-token",
    logout: vi.fn(),
  },
  api: {
    getCacheStats: vi.fn(),
    resetCacheMetrics: vi.fn(),
    clearLocalCache: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/stores/admin", () => ({
  useAdminStore: () => mocks.adminStore,
}));

vi.mock("@/utils/api", () => ({
  getCacheStats: (...args) => mocks.api.getCacheStats(...args),
  resetCacheMetrics: (...args) => mocks.api.resetCacheMetrics(...args),
  clearLocalCache: (...args) => mocks.api.clearLocalCache(...args),
}));

vi.mock("@/components/ChartCard.vue", () => ({
  default: defineComponent({
    name: "ChartCard",
    props: ["title", "labels", "datasets"],
    setup() {
      return () => h("div");
    },
  }),
}));

vi.mock("@/components/AdminLayout.vue", () => ({
  default: defineComponent({
    name: "AdminLayoutStub",
    setup(_, { slots }) {
      return () =>
        h(
          "div",
          { "data-testid": "admin-layout" },
          slots.default ? slots.default() : [],
        );
    },
  }),
}));

// We don't ``vi.mock("element-plus", ...)`` because the package's resolved
// module identity differs between the test runner's imports and the SFC's
// imports (the bundler resolves through ``./es/index.mjs``, vitest's
// transformer keeps a pre-loaded copy from setup, and the test-file mock
// fails to intercept the SFC's reference). We can't ``import`` it
// statically either: ``element-plus`` is in ``src/kohaku-hub-admin/node_modules``
// while this test file lives outside that package and Vite's import-analysis
// rejects the bare specifier. So we lazily resolve it via ``vi.importActual``
// in ``beforeEach`` (which honors the SFC's resolution path because vitest
// reuses the SFC's plugin chain) and ``spyOn`` the methods we need.
import CachePage from "@/pages/cache.vue";

const messageBoxConfirmSpy = vi.fn();
const messageSuccessSpy = vi.fn();
const messageErrorSpy = vi.fn();
let elementPlusModule;

const ENABLED_PAYLOAD = {
  metrics: {
    configured_enabled: true,
    client_initialized: true,
    namespace: "kh",
    hits: { lakefs: 120, repo: 45 },
    misses: { lakefs: 8, repo: 12 },
    errors: {},
    set_count: { lakefs: 8, repo: 12 },
    invalidate_count: { repo: 3 },
    singleflight_contention: 5,
    last_flush_run_id: "abcdef0123456789abcdef0123456789abcdef01",
    last_flush_at_ms: 1_700_000_000_000,
    last_flushed_keys: 7,
  },
  memory: {
    available: true,
    used_memory: 4_194_304,
    used_memory_human: "4.00M",
    maxmemory: 536_870_912,
    maxmemory_human: "512.00M",
    maxmemory_policy: "allkeys-lfu",
    evicted_keys: 0,
  },
};

const DEGRADED_PAYLOAD = {
  metrics: {
    configured_enabled: true,
    // Configured on but client not initialized — silent-degradation state.
    client_initialized: false,
    namespace: "kh",
    hits: {},
    misses: {},
    errors: {},
    set_count: {},
    invalidate_count: {},
    singleflight_contention: 0,
    last_flush_run_id: null,
    last_flush_at_ms: null,
    last_flushed_keys: 0,
  },
  memory: { available: false, reason: "client not initialized" },
};

const DISABLED_PAYLOAD = {
  metrics: {
    configured_enabled: false,
    client_initialized: false,
    namespace: "kh",
    hits: {},
    misses: {},
    errors: {},
    set_count: {},
    invalidate_count: {},
    singleflight_contention: 0,
    last_flush_run_id: null,
    last_flush_at_ms: null,
    last_flushed_keys: 0,
  },
  memory: { available: false, reason: "client not initialized" },
};

const noop = () => {};
const MEMORY_PAYLOAD = {
  ...DISABLED_PAYLOAD,
  backend: {
    mode: "memory",
    redis_configured: false,
    redis_available: false,
    fallback_enabled: true,
    reason: "redis_not_configured",
    instance_id: "worker-a",
    pid: 42,
    scope: "process",
    started_at_ms: 1_700_000_000_000,
    sampled_at_ms: 1_700_000_060_000,
    next_retry_at_ms: null,
  },
  local: {
    entries: 9,
    max_entries: 10,
    used_bytes: 900,
    max_bytes: 1000,
    peak_entries: 10,
    peak_bytes: 980,
    hits: 30,
    misses: 10,
    sets: 12,
    evictions: 2,
    expirations: 3,
    rejected_oversize: 4,
    clears: 0,
    cleanup_interval_seconds: 15,
    namespaces: [{ namespace: "commit-count", entries: 9, used_bytes: 900 }],
  },
  process: { rss_bytes: 104857600, rss_source: "proc" },
  history: [
    {
      timestamp_ms: 1_700_000_000_000,
      entries: 3,
      used_bytes: 300,
      rss_bytes: 94371840,
    },
    {
      timestamp_ms: 1_700_000_060_000,
      entries: 9,
      used_bytes: 900,
      rss_bytes: 104857600,
    },
  ],
};

const mountedPages = [];
const noopDirective = {
  mounted: noop,
  updated: noop,
  beforeUnmount: noop,
};

function mountPage() {
  const wrapper = mount(CachePage, {
    global: {
      stubs: {
        ...ElementPlusStubs,
        ElTooltip: defineComponent({
          props: ["content"],
          setup(props, { slots }) {
            return () => h("span", { title: props.content }, slots.default?.());
          },
        }),
      },
      directives: {
        loading: noopDirective,
      },
    },
  });
  mountedPages.push(wrapper);
  return wrapper;
}

describe("admin cache page", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    mocks.router.push.mockReset();
    mocks.adminStore.logout.mockReset();
    mocks.adminStore.token = "admin-token";
    mocks.api.getCacheStats.mockReset();
    mocks.api.resetCacheMetrics.mockReset();
    mocks.api.clearLocalCache.mockReset();
    messageBoxConfirmSpy.mockReset();
    messageSuccessSpy.mockReset();
    messageErrorSpy.mockReset();

    if (!elementPlusModule) {
      elementPlusModule = await vi.importActual("element-plus");
    }

    // Hijack ElMessageBox.confirm and ElMessage.{success,error} via
    // spyOn so the SFC's ``await ElMessageBox.confirm(...)`` lands in
    // our test-controllable spy. ``afterEach -> vi.restoreAllMocks()``
    // (declared in setup/vitest.setup.js) restores the originals after
    // each test.
    vi.spyOn(elementPlusModule.ElMessageBox, "confirm").mockImplementation(
      (...args) => messageBoxConfirmSpy(...args),
    );
    vi.spyOn(elementPlusModule.ElMessage, "success").mockImplementation(
      (...args) => messageSuccessSpy(...args),
    );
    vi.spyOn(elementPlusModule.ElMessage, "error").mockImplementation(
      (...args) => messageErrorSpy(...args),
    );
  });

  afterEach(() => {
    mountedPages.splice(0).forEach((wrapper) => wrapper.unmount());
    vi.useRealTimers();
  });

  it("loads stats on mount and renders one row per cache namespace", async () => {
    mocks.api.getCacheStats.mockResolvedValue(ENABLED_PAYLOAD);
    const wrapper = mountPage();
    await flushPromises();

    expect(mocks.api.getCacheStats).toHaveBeenCalledWith("admin-token");

    const overall = wrapper.get('[data-testid="cache-overall"]');
    expect(overall.text()).toContain("Enabled");
    expect(overall.text()).toContain("kh");
    expect(overall.text()).toContain("4.00M");
    expect(overall.text()).toContain("allkeys-lfu");

    const bootstrap = wrapper.get('[data-testid="cache-bootstrap"]');
    expect(bootstrap.text()).toContain("abcdef012345");

    // namespaces table picks up exactly one row per namespace key the
    // backend returned, regardless of which counter dict it appears in.
    // ``cache-namespace-table`` is the wrapping card; the actual <table>
    // is inside it (rendered by the ElTable stub with data-row-count).
    const card = wrapper.get('[data-testid="cache-namespace-table"]');
    const table = card.get('[data-el-table="true"]');
    expect(table.attributes("data-row-count")).toBe("2");
    expect(card.text()).toContain("lakefs");
    expect(card.text()).toContain("repo");
  });

  it("shows 'Degraded' when configured-on but client not initialized", async () => {
    mocks.api.getCacheStats.mockResolvedValue(DEGRADED_PAYLOAD);
    const wrapper = mountPage();
    await flushPromises();

    const overall = wrapper.get('[data-testid="cache-overall"]');
    expect(overall.text()).toContain("Degraded");
  });

  it("shows 'Disabled' when configured off, and disables the reset button", async () => {
    mocks.api.getCacheStats.mockResolvedValue(DISABLED_PAYLOAD);
    const wrapper = mountPage();
    await flushPromises();

    const overall = wrapper.get('[data-testid="cache-overall"]');
    expect(overall.text()).toContain("Disabled");

    const resetButton = wrapper.get('[data-testid="cache-reset-metrics"]');
    expect(resetButton.attributes("disabled")).toBeDefined();
  });

  it("re-fetches when the user clicks Refresh", async () => {
    mocks.api.getCacheStats.mockResolvedValue(ENABLED_PAYLOAD);
    const wrapper = mountPage();
    await flushPromises();

    const button = wrapper.get('[data-testid="cache-refresh"]');
    await button.trigger("click");
    await flushPromises();

    expect(mocks.api.getCacheStats).toHaveBeenCalledTimes(2);
  });

  it("calls reset endpoint after the operator confirms the dialog", async () => {
    mocks.api.getCacheStats.mockResolvedValue(ENABLED_PAYLOAD);
    mocks.api.resetCacheMetrics.mockResolvedValue({ reset: true });
    messageBoxConfirmSpy.mockResolvedValue("confirm");

    const wrapper = mountPage();
    await flushPromises();

    const resetButton = wrapper.get('[data-testid="cache-reset-metrics"]');
    await resetButton.trigger("click");
    await flushPromises();

    expect(messageBoxConfirmSpy).toHaveBeenCalled();
    expect(mocks.api.resetCacheMetrics).toHaveBeenCalledWith("admin-token");
    // After reset, page re-loads stats silently to refresh the counters.
    expect(mocks.api.getCacheStats).toHaveBeenCalledTimes(2);
  });

  it("does not call reset endpoint when the operator cancels the dialog", async () => {
    mocks.api.getCacheStats.mockResolvedValue(ENABLED_PAYLOAD);
    messageBoxConfirmSpy.mockRejectedValue(new Error("user cancelled"));

    const wrapper = mountPage();
    await flushPromises();

    const resetButton = wrapper.get('[data-testid="cache-reset-metrics"]');
    await resetButton.trigger("click");
    await flushPromises();

    expect(messageBoxConfirmSpy).toHaveBeenCalled();
    expect(mocks.api.resetCacheMetrics).not.toHaveBeenCalled();
  });

  it("logs the operator out when the backend returns 401", async () => {
    const failure = new Error("unauthorized");
    failure.response = { status: 401, data: { detail: "no auth" } };
    mocks.api.getCacheStats.mockRejectedValueOnce(failure);

    mountPage();
    await flushPromises();

    expect(mocks.adminStore.logout).toHaveBeenCalledTimes(1);
    expect(mocks.router.push).toHaveBeenCalledWith("/login");
  });

  it("treats a 403 response the same as 401", async () => {
    const failure = new Error("forbidden");
    failure.response = { status: 403, data: { detail: "denied" } };
    mocks.api.getCacheStats.mockRejectedValueOnce(failure);

    mountPage();
    await flushPromises();

    expect(mocks.adminStore.logout).toHaveBeenCalledTimes(1);
    expect(mocks.router.push).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login when no admin token is present", async () => {
    mocks.adminStore.token = "";
    mountPage();
    await flushPromises();

    expect(mocks.router.push).toHaveBeenCalledWith("/login");
    expect(mocks.api.getCacheStats).not.toHaveBeenCalled();
  });

  it("kicks off auto-refresh when the interval is changed and stops when reset", async () => {
    mocks.api.getCacheStats.mockResolvedValue(ENABLED_PAYLOAD);
    const wrapper = mountPage();
    await flushPromises();

    expect(mocks.api.getCacheStats).toHaveBeenCalledTimes(1);

    const select = wrapper.get('[data-el-select="true"]');
    await select.setValue(15);
    await flushPromises();

    await vi.advanceTimersByTimeAsync(45_000);
    // Three ticks of 15 s each fired while auto-refresh was on.
    expect(mocks.api.getCacheStats).toHaveBeenCalledTimes(4);

    await select.setValue(0);
    await flushPromises();

    vi.advanceTimersByTime(120_000);
    await flushPromises();
    expect(mocks.api.getCacheStats).toHaveBeenCalledTimes(4);
  });

  it("clears the auto-refresh timer on unmount", async () => {
    mocks.api.getCacheStats.mockResolvedValue(ENABLED_PAYLOAD);
    const wrapper = mountPage();
    await flushPromises();

    const select = wrapper.get('[data-el-select="true"]');
    await select.setValue(15);
    await flushPromises();

    expect(mocks.api.getCacheStats).toHaveBeenCalledTimes(1);

    wrapper.unmount();

    vi.advanceTimersByTime(120_000);
    await flushPromises();
    expect(mocks.api.getCacheStats).toHaveBeenCalledTimes(1);
  });

  it("shows bounded memory monitoring and actions without Redis", async () => {
    mocks.api.getCacheStats.mockResolvedValue(MEMORY_PAYLOAD);
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.get('[data-testid="cache-overall"]').text()).toContain(
      "In-process memory",
    );
    expect(wrapper.text()).toContain("worker-a");
    expect(wrapper.text()).toContain("Redis not configured");
    expect(wrapper.text()).not.toContain("redis_not_configured");
    const local = wrapper.get('[data-testid="cache-local"]');
    expect(local.text()).toContain("900 B");
    expect(local.text()).toContain("1,000 B");
    expect(local.text()).toContain("90.0%");
    expect(local.text()).toContain("75.0%");
    expect(local.text()).toContain("Capacity pressure");
    expect(
      wrapper.get('[data-testid="cache-local-namespaces"]').text(),
    ).toContain("commit-count");
    expect(
      wrapper.get('[data-testid="cache-reset-metrics"]').attributes("disabled"),
    ).toBeUndefined();
    expect(
      wrapper.get('[data-testid="cache-clear-local"]').attributes("disabled"),
    ).toBeUndefined();
    expect(wrapper.text()).toContain("Process RSS");
    expect(wrapper.text()).toContain("100.00 MB");
    expect(wrapper.text()).toContain("+10.00 MB");
    expect(wrapper.find('[data-testid="cache-bootstrap"]').exists()).toBe(
      false,
    );
  });

  it("keeps limits available in the legend without flattening small cache trends", async () => {
    mocks.api.getCacheStats.mockResolvedValue(MEMORY_PAYLOAD);
    const wrapper = mountPage();
    await flushPromises();
    const charts = wrapper.findAllComponents({ name: "ChartCard" });
    for (const chart of charts.slice(0, 2)) {
      const [usage, limit] = chart.props("datasets");
      expect(usage.hidden).not.toBe(true);
      expect(limit.label).toBe("Limit");
      expect(limit.hidden).toBe(true);
      expect(limit.data).toHaveLength(MEMORY_PAYLOAD.history.length);
    }
    expect(charts[2].props("datasets")).toHaveLength(1);
  });

  it("keeps Redis bootstrap visible while a configured Redis is unavailable", async () => {
    mocks.api.getCacheStats.mockResolvedValue({
      ...MEMORY_PAYLOAD,
      backend: {
        ...MEMORY_PAYLOAD.backend,
        redis_configured: true,
        reason: "connection_failed",
      },
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.find('[data-testid="cache-bootstrap"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="cache-overall"]').text()).toContain(
      "Redis unavailable",
    );
    expect(wrapper.text()).not.toContain("connection_failed");
  });

  it("clears only the displayed process after confirmation and sends its identity", async () => {
    mocks.api.getCacheStats.mockResolvedValue(MEMORY_PAYLOAD);
    mocks.api.clearLocalCache.mockResolvedValue({
      cleared: 9,
      instance_id: "worker-a",
    });
    messageBoxConfirmSpy.mockResolvedValue("confirm");
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.get('[data-testid="cache-clear-local"]').trigger("click");
    await flushPromises();
    expect(messageBoxConfirmSpy.mock.calls[0][0]).toContain("worker-a");
    expect(messageBoxConfirmSpy.mock.calls[0][0]).toContain("Redis");
    expect(mocks.api.clearLocalCache).toHaveBeenCalledWith(
      "admin-token",
      "worker-a",
    );
    expect(mocks.api.resetCacheMetrics).not.toHaveBeenCalled();
    expect(mocks.api.getCacheStats).toHaveBeenCalledTimes(2);
  });

  it("resets counters in memory mode without clearing entries", async () => {
    mocks.api.getCacheStats.mockResolvedValue(MEMORY_PAYLOAD);
    messageBoxConfirmSpy.mockResolvedValue("confirm");
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.get('[data-testid="cache-reset-metrics"]').trigger("click");
    await flushPromises();
    expect(mocks.api.resetCacheMetrics).toHaveBeenCalledWith(
      "admin-token",
      "worker-a",
    );
    expect(mocks.api.clearLocalCache).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="cache-local"]').text()).toContain(
      "900 B",
    );
  });

  it("keeps the last good snapshot visible and marks it stale on refresh failure", async () => {
    mocks.api.getCacheStats
      .mockResolvedValueOnce(MEMORY_PAYLOAD)
      .mockRejectedValue(new Error("offline"));
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.get('[data-testid="cache-refresh"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="cache-stale"]').text()).toContain(
      "Last successful sample",
    );
    expect(wrapper.get('[data-testid="cache-local"]').text()).toContain(
      "900 B",
    );
  });

  it("does not overlap requests or update an unmounted page", async () => {
    let resolve;
    mocks.api.getCacheStats.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const wrapper = mountPage();
    await wrapper.get('[data-el-select="true"]').setValue(5);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(mocks.api.getCacheStats).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    resolve(MEMORY_PAYLOAD);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(mocks.api.getCacheStats).toHaveBeenCalledTimes(1);
    expect(messageErrorSpy).not.toHaveBeenCalled();
  });

  it("replaces trends on worker change, bounds history and announces the new scope", async () => {
    mocks.api.getCacheStats
      .mockResolvedValueOnce(MEMORY_PAYLOAD)
      .mockResolvedValue({
        ...MEMORY_PAYLOAD,
        backend: {
          ...MEMORY_PAYLOAD.backend,
          instance_id: "worker-b",
          pid: 43,
        },
        history: Array.from({ length: 150 }, (_, i) => ({
          timestamp_ms: i + 1,
          entries: i,
          used_bytes: i,
          rss_bytes: null,
        })),
        process: { rss_bytes: null, rss_source: null },
      });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.get('[data-testid="cache-refresh"]').trigger("click");
    await flushPromises();
    expect(
      wrapper.get('[data-testid="cache-instance-change"]').text(),
    ).toContain("worker-b");
    const chart = wrapper.findAllComponents({ name: "ChartCard" })[0];
    expect(chart.props("labels")).toHaveLength(120);
    expect(chart.props("datasets")[0].data).not.toContain(900 / 1024);
    expect(wrapper.text()).toContain("RSS is unavailable");
  });

  it("does not clear when cancelled and reports a different-worker conflict", async () => {
    mocks.api.getCacheStats.mockResolvedValue(MEMORY_PAYLOAD);
    messageBoxConfirmSpy
      .mockRejectedValueOnce("cancel")
      .mockResolvedValue("confirm");
    mocks.api.clearLocalCache.mockRejectedValue({
      response: {
        status: 409,
        data: { detail: "Different process; refresh and retry" },
      },
    });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.get('[data-testid="cache-clear-local"]').trigger("click");
    await flushPromises();
    expect(mocks.api.clearLocalCache).not.toHaveBeenCalled();
    await wrapper.get('[data-testid="cache-clear-local"]').trigger("click");
    await flushPromises();
    expect(messageErrorSpy).toHaveBeenCalledWith(
      "Different process; refresh and retry",
    );
    expect(messageSuccessSpy).not.toHaveBeenCalled();
  });

  it("uses measured Redis state and renders local zero occupancy without inventing RSS", async () => {
    mocks.api.getCacheStats.mockResolvedValue({
      ...ENABLED_PAYLOAD,
      backend: {
        ...MEMORY_PAYLOAD.backend,
        mode: "redis",
        reason: "connected",
        redis_available: true,
      },
      local: {
        ...MEMORY_PAYLOAD.local,
        entries: 0,
        used_bytes: 0,
        hits: 0,
        misses: 0,
        namespaces: [],
      },
      process: { rss_bytes: null },
      history: [],
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.get('[data-testid="cache-overall"]').text()).toContain(
      "Redis",
    );
    expect(wrapper.text()).not.toContain("connected");
    expect(wrapper.get('[data-testid="cache-local"]').text()).toContain("0 B");
    expect(wrapper.text()).toContain("RSS is unavailable");
    expect(
      wrapper
        .find('[data-el-empty="true"][data-description="No samples yet"]')
        .exists(),
    ).toBe(true);
    expect(
      wrapper
        .find('[data-el-empty="true"][data-description="Local cache is empty"]')
        .exists(),
    ).toBe(true);
    expect(wrapper.findAllComponents({ name: "ChartCard" })).toHaveLength(0);
  });

  it("marks the hard-limit region and shows decreases over the same process window", async () => {
    mocks.api.getCacheStats.mockResolvedValue({
      ...MEMORY_PAYLOAD,
      backend: {
        ...MEMORY_PAYLOAD.backend,
        next_retry_at_ms: 1_700_000_065_000,
      },
      local: {
        ...MEMORY_PAYLOAD.local,
        used_bytes: 960,
        entries: 10,
      },
      history: [
        {
          timestamp_ms: 1_700_000_000_000,
          entries: 10,
          used_bytes: 1000,
          rss_bytes: 104857600,
        },
        {
          timestamp_ms: 1_700_000_060_000,
          entries: 9,
          used_bytes: 900,
          rss_bytes: 94371840,
        },
      ],
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.get('[data-testid="cache-local"]').text()).toContain(
      "Near capacity",
    );
    expect(wrapper.text()).toContain("Redis retry");
    expect(wrapper.text()).toContain("−10.00 MB");
  });

  it("pauses polling in a hidden tab and resumes without overlapping requests", async () => {
    mocks.api.getCacheStats.mockResolvedValue(MEMORY_PAYLOAD);
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.get('[data-el-select="true"]').setValue(5);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(mocks.api.getCacheStats).toHaveBeenCalledTimes(1);
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.api.getCacheStats).toHaveBeenCalledTimes(2);
  });

  it.each(["cache-clear-local", "cache-reset-metrics"])(
    "ends polling when %s loses authentication",
    async (selector) => {
      mocks.api.getCacheStats.mockResolvedValue(MEMORY_PAYLOAD);
      messageBoxConfirmSpy.mockResolvedValue("confirm");
      const error = { response: { status: 403 } };
      mocks.api.clearLocalCache.mockRejectedValue(error);
      mocks.api.resetCacheMetrics.mockRejectedValue(error);
      const wrapper = mountPage();
      await flushPromises();
      await wrapper.get('[data-el-select="true"]').setValue(5);
      await wrapper.get(`[data-testid="${selector}"]`).trigger("click");
      await flushPromises();
      expect(mocks.adminStore.logout).toHaveBeenCalledTimes(1);
      expect(mocks.router.push).toHaveBeenCalledWith("/login");
      await vi.advanceTimersByTimeAsync(20_000);
      expect(mocks.api.getCacheStats).toHaveBeenCalledTimes(1);
    },
  );

  it("reports reset failures without clearing the cached values", async () => {
    mocks.api.getCacheStats.mockResolvedValue(MEMORY_PAYLOAD);
    messageBoxConfirmSpy.mockResolvedValue("confirm");
    mocks.api.resetCacheMetrics.mockRejectedValue(new Error("reset failed"));
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.get('[data-testid="cache-reset-metrics"]').trigger("click");
    await flushPromises();
    expect(messageErrorSpy).toHaveBeenCalledWith("reset failed");
    expect(wrapper.get('[data-testid="cache-local"]').text()).toContain(
      "900 B",
    );
    expect(mocks.api.clearLocalCache).not.toHaveBeenCalled();
  });

  it("keeps auto-refresh errors quiet while exposing stale data", async () => {
    mocks.api.getCacheStats
      .mockResolvedValueOnce(MEMORY_PAYLOAD)
      .mockRejectedValue(new Error("offline"));
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.get('[data-el-select="true"]').setValue(5);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(wrapper.find('[data-testid="cache-stale"]').exists()).toBe(true);
    expect(messageErrorSpy).not.toHaveBeenCalled();
  });
});
