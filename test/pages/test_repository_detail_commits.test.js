import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  adminStore: { token: "admin-token", logout: vi.fn() },
  api: {
    listRepositories: vi.fn(),
    getRepositoryDetails: vi.fn(),
    getRepositoryStorageBreakdown: vi.fn(),
    recalculateAllRepoStorage: vi.fn(),
    listCommits: vi.fn(),
    deleteRepositoryAdmin: vi.fn(),
    moveRepositoryAdmin: vi.fn(),
    squashRepositoryAdmin: vi.fn(),
    getSiteConfig: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
  useRoute: () => ({ query: {} }),
}));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.adminStore }));
vi.mock("@/utils/api", () => ({
  ...mocks.api,
  formatBytes: (value) => String(value ?? 0),
}));
vi.mock("@/components/AdminLayout.vue", () => ({
  default: defineComponent({
    setup(_, { slots }) {
      return () => h("main", slots.default ? slots.default() : []);
    },
  }),
}));
vi.mock("@/components/FileTree.vue", () => ({
  default: defineComponent({
    setup() {
      return () => h("div");
    },
  }),
}));

import RepositoriesPage from "@/pages/repositories.vue";

describe("repository detail: the Commits tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.listRepositories.mockResolvedValue({ repositories: [], total: 0 });
    mocks.api.listCommits.mockResolvedValue({ commits: [{ commit_id: "d1" }] });
  });

  it("asks for the commits of this repository's own type, because a model and a dataset can share owner/name", async () => {
    const wrapper = mount(RepositoriesPage, { global: { stubs: ElementPlusStubs } });
    await flushPromises();
    wrapper.vm.selectedRepo = {
      repo_type: "dataset",
      namespace: "owner",
      name: "same",
      full_id: "owner/same",
    };

    await wrapper.vm.loadRepoCommits();

    expect(mocks.api.listCommits).toHaveBeenCalledWith("admin-token", {
      repo_full_id: "owner/same",
      repo_type: "dataset",
      limit: 20,
    });
    expect(wrapper.vm.repoCommits).toEqual([{ commit_id: "d1" }]);
    wrapper.unmount();
  });
});
