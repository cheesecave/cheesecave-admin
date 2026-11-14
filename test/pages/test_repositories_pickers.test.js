import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ElMessage, ElMessageBox } from "element-plus";

import { ElementPlusStubs } from "../helpers/vue";
import { EntityPickerStub } from "../helpers/entityPicker";

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

const routeState = vi.hoisted(() => ({ query: {} }));
vi.mock("vue-router", () => ({ useRouter: () => mocks.router, useRoute: () => routeState }));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.adminStore }));
vi.mock("@/utils/api", () => ({ ...mocks.api, formatBytes: (value) => String(value ?? 0) }));
vi.mock("@/components/AdminLayout.vue", () => ({
  default: defineComponent({
    setup(_, { slots }) {
      return () => h("main", slots.default ? slots.default() : []);
    },
  }),
}));
vi.mock("@/components/FileTree.vue", () => ({ default: defineComponent({ setup: () => () => h("div") }) }));

import RepositoriesPage from "@/pages/repositories.vue";

const REPO = { id: 1, repo_type: "model", namespace: "owner", name: "demo", full_id: "owner/demo", owner_username: "owner", used_bytes: 0, created_at: "2026-01-01T00:00:00Z" };

async function mountPage() {
  const wrapper = mount(RepositoriesPage, { global: { stubs: { ...ElementPlusStubs, EntityPicker: EntityPickerStub } } });
  await flushPromises();
  return wrapper;
}
const button = (w, text) => w.findAll("button").find((b) => b.text().includes(text));

describe("repositories: namespaces are picked, not typed", () => {
  // Spies of this file only: restoreAllMocks would also undo the matchMedia stub of the shared setup file.
  const spies = {};
  beforeEach(() => {
    vi.clearAllMocks();
    spies.confirm = vi.spyOn(ElMessageBox, "confirm").mockResolvedValue("confirm");
    spies.success = vi.spyOn(ElMessage, "success").mockImplementation(() => {});
    spies.warning = vi.spyOn(ElMessage, "warning").mockImplementation(() => {});
    mocks.adminStore.token = "admin-token";
    mocks.api.listRepositories.mockResolvedValue({ repositories: [REPO], total: 1 });
    mocks.api.getRepositoryDetails.mockResolvedValue(REPO);
    mocks.api.getSiteConfig.mockResolvedValue({ capabilities: { repository_operations: {} } });
    mocks.api.moveRepositoryAdmin.mockResolvedValue({});
  });
  afterEach(() => {
    Object.values(spies).forEach((spy) => spy.mockRestore());
    routeState.query = {};
  });

  it("the namespace filter picks a user or organization and also takes any text", async () => {
    const w = await mountPage();
    const filter = w.get('[data-testid="repo-namespace-filter"]');

    expect(filter.attributes("data-kinds")).toBe("user,org");
    expect(filter.attributes("data-free-text")).toBe("true");
  });

  it("lists the repositories of the chosen namespace when the filters are applied", async () => {
    const w = await mountPage();
    mocks.api.listRepositories.mockClear();

    await w.get('[data-testid="repo-namespace-filter"] input').setValue("aurora-labs");
    await button(w, "Apply Filters").trigger("click");
    await flushPromises();

    expect(mocks.api.listRepositories.mock.calls.at(-1)[1].namespace).toBe("aurora-labs");
  });

  describe("repository visibility", () => {
    it.each([
      ["Public", { private: false, invite_mode: false, visibility: "public" }, "success"],
      ["Private", { private: true, invite_mode: false, visibility: "private" }, "warning"],
      ["Invite", { private: true, invite_mode: true, visibility: "invite" }, "warning"],
      ["Private", { private: true }, "warning"],
    ])("shows %s in the list and detail without changing privacy", async (label, visibility, color) => {
      const repository = { ...REPO, ...visibility };
      mocks.api.listRepositories.mockResolvedValue({ repositories: [repository], total: 1 });
      mocks.api.getRepositoryDetails.mockResolvedValue(repository);

      const w = await mountPage();
      const listBadge = w.get('[data-col-label="Repository"] [data-el-tag]');
      expect(listBadge.text()).toBe(label);
      expect(listBadge.attributes("data-type")).toBe(color);

      await button(w, "View Details").trigger("click");
      await flushPromises();
      const detailBadge = w.get('[data-tab="overview"] [data-el-tag][data-effect="plain"]');
      expect(detailBadge.text()).toBe(label);
      expect(detailBadge.attributes("data-type")).toBe(color);
      expect(w.vm.selectedRepo.private).toBe(visibility.private);
      w.unmount();
    });
  });

  describe("moving a repository", () => {
    const openActions = async () => {
      const w = await mountPage();
      await button(w, "View Details").trigger("click");
      await flushPromises();
      return w;
    };

    it("picks only an existing user or organization as the target namespace", async () => {
      const w = await openActions();
      const target = w.get('[data-testid="repo-move-namespace"]');

      expect(target.attributes("data-kinds")).toBe("user,org");
      expect(target.attributes("data-free-text")).toBe("false");
    });

    it("moves the repository to the picked namespace and the new name after confirming", async () => {
      const w = await openActions();

      await w.get('[data-testid="repo-move-namespace"] input').setValue("aurora-labs");
      await w.get('input[placeholder="new-name"]').setValue("renamed");
      await button(w, "Move Repository").trigger("click");
      await flushPromises();

      expect(spies.confirm.mock.calls[0][0]).toBe("Move repository from owner/demo to aurora-labs/renamed?");
      expect(mocks.api.moveRepositoryAdmin).toHaveBeenCalledWith("admin-token", "model", "owner", "demo", "aurora-labs", "renamed");
      expect(spies.success).toHaveBeenCalledWith("Repository moved successfully");
    });

    it("asks for both the namespace and the name before doing anything", async () => {
      const w = await openActions();

      await w.get('[data-testid="repo-move-namespace"] input').setValue("aurora-labs");
      await button(w, "Move Repository").trigger("click");
      await flushPromises();

      expect(spies.warning).toHaveBeenCalledWith("Please enter both namespace and name");
      expect(mocks.api.moveRepositoryAdmin).not.toHaveBeenCalled();
    });
  });

  describe("open=type:owner/name (a search result, a quota table) opens that repository", () => {
    const dialogOpen = (w) => w.vm.repoDialogVisible;

    it("opens the details of that very repository, of that type, and lists it by its full id", async () => {
      routeState.query = { q: "owner/shared", open: "dataset:owner/shared" };
      mocks.api.getRepositoryDetails.mockResolvedValue({ ...REPO, repo_type: "dataset", name: "shared", full_id: "owner/shared" });
      const w = await mountPage();

      expect(mocks.api.listRepositories.mock.calls[0][1].search).toBe("owner/shared");
      expect(mocks.api.getRepositoryDetails).toHaveBeenCalledWith("admin-token", "dataset", "owner", "shared");
      expect(dialogOpen(w)).toBe(true);
    });

    it("says so when the repository cannot be loaded", async () => {
      const error = vi.spyOn(ElMessage, "error").mockImplementation(() => {});
      routeState.query = { open: "model:owner/gone" };
      mocks.api.getRepositoryDetails.mockRejectedValue({ response: { status: 404, data: { detail: { error: "Repository not found" } } } });
      const w = await mountPage();

      expect(error).toHaveBeenCalledWith("Repository not found");
      expect(dialogOpen(w)).toBe(false);
      error.mockRestore();
    });

    it("ignores a reference that is not type:owner/name, and a value that is not text", async () => {
      for (const open of ["owner/shared", "dataset:", ["model:a/b"]]) {
        routeState.query = { open };
        const w = await mountPage();
        expect(mocks.api.getRepositoryDetails).not.toHaveBeenCalled();
        expect(dialogOpen(w)).toBe(false);
        w.unmount();
      }
    });
  });
});

