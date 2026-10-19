import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ElementPlusStubs } from "../helpers/vue";

// Every API call fails: the pages keep their empty initial state and draw their
// controls, which is all these tests look at.
vi.mock("@/utils/api", async (importOriginal) => {
  const real = await importOriginal();
  return Object.fromEntries(
    Object.entries(real).map(([name, value]) => [
      name,
      typeof value === "function" && name !== "formatBytes"
        ? vi.fn(async () => {
            throw new Error("offline");
          })
        : value,
    ]),
  );
});
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {} }),
}));
vi.mock("@/stores/admin", () => ({
  useAdminStore: () => ({ token: "admin-token", logout: vi.fn() }),
}));
vi.mock("@/components/AdminLayout.vue", () => ({
  default: defineComponent({
    setup(_, { slots }) {
      return () => h("main", slots.default ? slots.default() : []);
    },
  }),
}));

import { listFallbackSources } from "@/utils/api";
import UsersPage from "@/pages/users.vue";
import RepositoriesPage from "@/pages/repositories.vue";
import HealthPage from "@/pages/health.vue";
import CachePage from "@/pages/cache.vue";
import TasksPage from "@/pages/tasks.vue";
import FallbackSourcesPage from "@/pages/fallback-sources.vue";
import DatabaseViewerPage from "@/pages/DatabaseViewer.vue";

let wrapper;
async function mountPage(page, props = {}) {
  wrapper = mount(page, {
    props,
    global: {
      stubs: ElementPlusStubs,
      directives: { loading: {} },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("controls without visible text have an accessible name", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(listFallbackSources).mockResolvedValue([
      {
        id: 1,
        name: "HuggingFace",
        url: "https://huggingface.co",
        enabled: true,
      },
    ]);
  });
  afterEach(() => wrapper?.unmount());

  it("names the organizations switch of the users page", async () => {
    await mountPage(UsersPage);
    expect(wrapper.find('[aria-label="Show organizations"]').exists()).toBe(
      true,
    );
  });

  it("names the repository type filter", async () => {
    await mountPage(RepositoriesPage);
    expect(wrapper.find('[aria-label="Repository type"]').exists()).toBe(true);
  });

  it.each([
    ["health", HealthPage],
    ["cache", CachePage],
    ["tasks", TasksPage],
  ])("names the auto-refresh selector of the %s page", async (_, page) => {
    await mountPage(page);
    expect(wrapper.find('[aria-label="Auto-refresh interval"]').exists()).toBe(
      true,
    );
  });

  it("names the icon-only buttons of a fallback source", async () => {
    await mountPage(FallbackSourcesPage);
    const actions = wrapper.get(".source-actions");
    expect(actions.find('[aria-label="Edit source"]').exists()).toBe(true);
    expect(actions.find('[aria-label="Delete source"]').exists()).toBe(true);
  });

  it("gives the scrollable lists of the database viewer a name and keyboard focus", async () => {
    await mountPage(DatabaseViewerPage);
    for (const [selector, name] of [
      [".tables-list", "Database tables"],
      [".templates-list", "Query templates"],
    ]) {
      const list = wrapper.get(selector);
      expect(list.attributes("aria-label")).toBe(name);
      expect(list.attributes("role")).toBe("region");
      expect(list.attributes("tabindex")).toBe("0");
    }
  });

  it("uses no heading level that skips the page's h1 on the fallback source page", async () => {
    await mountPage(FallbackSourcesPage);
    // Levels never skip: h1 (page), h2 (sections), h3 (subsections), no h4.
    expect(wrapper.findAll("h4")).toHaveLength(0);
    expect(wrapper.get(".source-title h2").text()).toBe("HuggingFace");
  });
});
