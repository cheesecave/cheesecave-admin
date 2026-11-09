import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ElMessage } from "element-plus";

import { ElementPlusStubs } from "../helpers/vue";
import { EntityPickerStub } from "../helpers/entityPicker";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  adminStore: { token: "admin-token", logout: vi.fn() },
  api: { listCommits: vi.fn() },
}));

const routeState = vi.hoisted(() => ({ query: {} }));
vi.mock("vue-router", () => ({ useRouter: () => mocks.router, useRoute: () => routeState }));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.adminStore }));
vi.mock("@/utils/api", () => ({ ...mocks.api }));
vi.mock("@/components/AdminLayout.vue", () => ({
  default: defineComponent({
    setup(_, { slots }) {
      return () => h("main", slots.default ? slots.default() : []);
    },
  }),
}));

import CommitsPage from "@/pages/commits.vue";

const COMMITS = [
  { id: 1, commit_id: "aaaaaaaaaaaa", repo_full_id: "o/b-repo", repo_type: "model", branch: "main", username: "Zed", message: "first", created_at: "2026-01-01T00:00:00Z" },
  { id: 3, commit_id: "cccccccccccc", repo_full_id: "o/a-repo", repo_type: "dataset", branch: "dev", username: "amy", message: "third", created_at: "2026-03-01T00:00:00Z" },
  { id: 2, commit_id: "bbbbbbbbbbbb", repo_full_id: null, repo_type: "space", branch: "main", username: null, message: null, created_at: "2026-02-01T00:00:00Z" },
];

async function mountPage() {
  const wrapper = mount(CommitsPage, { global: { stubs: { ...ElementPlusStubs, EntityPicker: EntityPickerStub }, directives: { loading: {} } } });
  await flushPromises();
  return wrapper;
}
const button = (w, text) => w.findAll("button").find((b) => b.text() === text);
const ids = (w) => w.vm.sortedCommits.map((c) => c.id);

describe("commits page", () => {
  let error;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminStore.token = "admin-token";
    mocks.api.listCommits.mockResolvedValue({ commits: COMMITS });
    error = vi.spyOn(ElMessage, "error").mockImplementation(() => {});
    routeState.query = {};
  });

  describe("filters", () => {
    it("lists the newest commits when it opens", async () => {
      const w = await mountPage();

      expect(mocks.api.listCommits).toHaveBeenCalledWith("admin-token", {
        repo_full_id: undefined,
        repo_type: undefined,
        username: undefined,
        limit: 20,
        offset: 0,
      });
      expect(w.vm.commits).toHaveLength(3);
    });

    it("picks a repository by its type and full id, and an author who may also be typed", async () => {
      const w = await mountPage();

      const repo = w.get('[data-testid="commits-repo-picker"]');
      expect(repo.attributes("data-kinds")).toBe("repo");
      expect(repo.attributes("data-value-as")).toBe("repo");
      expect(repo.attributes("data-free-text")).toBe("false");
      const author = w.get('[data-testid="commits-author-picker"]');
      expect(author.attributes("data-kinds")).toBe("user");
      expect(author.attributes("data-free-text")).toBe("true");
    });

    it("sends the type and the full id apart, and the author, and starts again from page one", async () => {
      const w = await mountPage();
      w.vm.currentPage = 4;
      await w.get('[data-testid="commits-repo-picker"] input').setValue("dataset:owner/shared");
      await w.get('[data-testid="commits-author-picker"] input').setValue("alice");
      mocks.api.listCommits.mockClear();

      await button(w, "Apply Filters").trigger("click");
      await flushPromises();

      expect(mocks.api.listCommits).toHaveBeenCalledWith("admin-token", {
        repo_full_id: "owner/shared",
        repo_type: "dataset",
        username: "alice",
        limit: 20,
        offset: 0,
      });
      expect(w.vm.currentPage).toBe(1);
    });

    it("sends no repository filter for a value that is not type:owner/name", async () => {
      const w = await mountPage();
      await w.get('[data-testid="commits-repo-picker"] input').setValue("model:owner/odd:name");
      mocks.api.listCommits.mockClear();

      await button(w, "Apply Filters").trigger("click");
      await flushPromises();

      expect(mocks.api.listCommits.mock.calls[0][1]).toMatchObject({ repo_full_id: undefined, repo_type: undefined });
    });

    it("asks for the page that was chosen", async () => {
      const w = await mountPage();
      w.vm.currentPage = 3;
      w.vm.pageSize = 50;
      mocks.api.listCommits.mockClear();

      await w.vm.loadCommits();

      expect(mocks.api.listCommits.mock.calls[0][1]).toMatchObject({ limit: 50, offset: 100 });
    });

    it("resets both filters and lists everything again", async () => {
      const w = await mountPage();
      await w.get('[data-testid="commits-repo-picker"] input').setValue("dataset:owner/shared");
      await w.get('[data-testid="commits-author-picker"] input').setValue("alice");
      w.vm.currentPage = 2;
      mocks.api.listCommits.mockClear();

      await button(w, "Reset").trigger("click");
      await flushPromises();

      expect(w.vm.filterRepo).toBeNull();
      expect(w.vm.filterUsername).toBeNull();
      expect(w.vm.currentPage).toBe(1);
      expect(mocks.api.listCommits).toHaveBeenCalledWith("admin-token", { repo_full_id: undefined, repo_type: undefined, username: undefined, limit: 20, offset: 0 });
    });
  });

  describe("opened from a link (repo=type:owner/name, author=name)", () => {
    it("starts with that repository and author already chosen", async () => {
      routeState.query = { repo: "dataset:owner/shared", author: "alice" };
      const w = await mountPage();

      expect(mocks.api.listCommits).toHaveBeenCalledWith("admin-token", {
        repo_full_id: "owner/shared",
        repo_type: "dataset",
        username: "alice",
        limit: 20,
        offset: 0,
      });
      expect(w.vm.filterRepo).toBe("dataset:owner/shared");
      expect(w.get('[data-testid="commits-repo-picker"] input').element.value).toBe("dataset:owner/shared");
      expect(w.get('[data-testid="commits-author-picker"] input').element.value).toBe("alice");
    });

    it("takes the repository alone, or the author alone", async () => {
      routeState.query = { repo: "model:o/n" };
      await mountPage();
      expect(mocks.api.listCommits.mock.calls[0][1]).toMatchObject({ repo_full_id: "o/n", repo_type: "model", username: undefined });

      mocks.api.listCommits.mockClear();
      routeState.query = { author: "alice" };
      await mountPage();
      expect(mocks.api.listCommits.mock.calls[0][1]).toMatchObject({ repo_full_id: undefined, username: "alice" });
    });

    it("ignores a repository that is not type:owner/name, and values that are not text", async () => {
      routeState.query = { repo: "owner/shared", author: ["a", "b"] };
      const w = await mountPage();

      expect(mocks.api.listCommits.mock.calls[0][1]).toMatchObject({ repo_full_id: undefined, repo_type: undefined, username: undefined });
      expect(w.vm.filterRepo).toBeNull();
      expect(w.vm.filterUsername).toBeNull();

      routeState.query = { repo: ["model:a/b"] };
      expect((await mountPage()).vm.filterRepo).toBeNull();
    });
  });

  describe("loading", () => {
    it("sends the operator to the login page, and asks nothing, without a token", async () => {
      mocks.adminStore.token = "";
      await mountPage();

      expect(mocks.router.push).toHaveBeenCalledWith("/login");
      expect(mocks.api.listCommits).not.toHaveBeenCalled();
    });

    it.each([401, 403])("signs out on %s", async (status) => {
      mocks.api.listCommits.mockRejectedValue({ response: { status } });
      const w = await mountPage();

      expect(error).toHaveBeenCalledWith("Invalid admin token. Please login again.");
      expect(mocks.adminStore.logout).toHaveBeenCalled();
      expect(mocks.router.push).toHaveBeenCalledWith("/login");
      expect(w.vm.loading).toBe(false);
    });

    it("shows the backend's message for any other failure", async () => {
      mocks.api.listCommits.mockRejectedValue({ response: { status: 500, data: { detail: { error: "database down" } } } });
      const w = await mountPage();

      expect(error).toHaveBeenCalledWith("database down");
      expect(mocks.adminStore.logout).not.toHaveBeenCalled();
      expect(w.vm.loading).toBe(false);
    });

    it("falls back to its own message when the failure says nothing", async () => {
      mocks.api.listCommits.mockRejectedValue(new Error(""));
      await mountPage();

      expect(error).toHaveBeenCalledWith("Failed to load commits");
    });
  });

  describe("order and wording", () => {
    it("shows the newest first, and nothing for no commits", async () => {
      const w = await mountPage();
      expect(ids(w)).toEqual([3, 2, 1]);

      w.vm.commits = [];
      expect(w.vm.sortedCommits).toEqual([]);
    });

    it("sorts by id, author and repository in either direction, with missing values first", async () => {
      const w = await mountPage();

      w.vm.handleSortChange({ prop: "id", order: "ascending" });
      expect(ids(w)).toEqual([1, 2, 3]);
      w.vm.handleSortChange({ prop: "id", order: "descending" });
      expect(ids(w)).toEqual([3, 2, 1]);
      w.vm.handleSortChange({ prop: "username", order: "ascending" });
      expect(ids(w)).toEqual([2, 3, 1]);
      w.vm.handleSortChange({ prop: "repo_full_id", order: "ascending" });
      expect(ids(w)).toEqual([2, 3, 1]);
      w.vm.handleSortChange({ prop: "created_at", order: "ascending" });
      expect(ids(w)).toEqual([1, 2, 3]);
    });

    it("sorts by any other column as it is, and returns to newest first when the sort is cleared", async () => {
      const w = await mountPage();

      w.vm.handleSortChange({ prop: "branch", order: "ascending" });
      expect(ids(w)).toEqual([3, 1, 2]);
      w.vm.handleSortChange({ prop: "branch", order: "descending" });
      expect(ids(w)).toEqual([1, 2, 3]);

      w.vm.handleSortChange({ prop: null, order: null });
      expect(ids(w)).toEqual([3, 2, 1]);
      w.vm.handleSortChange({ prop: "id", order: null });
      expect(w.vm.sortBy).toBe("created_at");
    });

    it("colours repository types, shortens ids and long messages, and formats dates", async () => {
      const w = await mountPage();

      expect(["model", "dataset", "space", "other"].map((t) => w.vm.getRepoTypeColor(t))).toEqual(["primary", "success", "warning", "info"]);
      expect(w.vm.truncateCommitId("0123456789abcdef")).toBe("01234567");
      expect(w.vm.truncateCommitId(undefined)).toBe("");
      expect(w.vm.truncateMessage(null)).toBe("");
      expect(w.vm.truncateMessage("short")).toBe("short");
      expect(w.vm.truncateMessage("x".repeat(120))).toBe(`${"x".repeat(100)}...`);
      expect(w.vm.truncateMessage("abcdefgh", 4)).toBe("abcd...");
      expect(w.vm.formatDate("2026-01-02T03:04:05")).toBe("2026-01-02 03:04:05");
    });
  });
});
