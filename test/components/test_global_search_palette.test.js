import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  admin: { token: "admin-token" },
  globalSearch: vi.fn(),
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.admin }));
vi.mock("@/utils/api", () => ({
  globalSearch: (...args) => mocks.globalSearch(...args),
}));

import GlobalSearch from "@/components/GlobalSearch.vue";

const USER = {
  id: 7,
  username: "mai_lin",
  email: "m@example.org",
  email_verified: true,
};

describe("GlobalSearch as a command palette", () => {
  let wrapper;
  const open = async () => {
    wrapper = mount(GlobalSearch, {
      attachTo: document.body,
      global: { stubs: ElementPlusStubs },
    });
    wrapper.vm.openDialog();
    await wrapper.vm.$nextTick();
  };
  const labels = () =>
    wrapper
      .findAll('[data-testid="palette-item"] .result-title')
      .map((n) => n.text());
  const type = async (text) => {
    const input = wrapper.get("input");
    await input.setValue(text);
    await input.trigger("input");
  };
  const press = (key) => wrapper.get("input").trigger("keydown", { key });

  beforeEach(() => {
    vi.useFakeTimers();
    mocks.router.push.mockReset();
    mocks.globalSearch
      .mockReset()
      .mockResolvedValue({ results: { users: [USER] } });
  });
  afterEach(() => {
    wrapper?.unmount();
    vi.useRealTimers();
  });

  it("opens on pages and actions, the first one selected", async () => {
    await open();
    expect(wrapper.find('[data-testid="palette"]').exists()).toBe(true);
    expect(labels()).toEqual([
      "Create user",
      "Reset a password",
      "New invitation",
      "Failed tasks, last 24 h",
      "Users over quota",
      "Overview",
      "Health",
      "Background Tasks",
      "Storage",
    ]);
    const items = wrapper.findAll('[data-testid="palette-item"]');
    expect(items[0].classes()).toContain("selected");
    expect(items[1].classes()).not.toContain("selected");
    expect(items[0].text()).toContain("Action");
    expect(items[5].text()).toContain("Page");
  });

  it("filters by what is typed, case-insensitively, and says what to do for a real search", async () => {
    await open();
    await type("T");
    expect(labels()).toEqual([
      "Create user",
      "Reset a password",
      "New invitation",
      "Failed tasks, last 24 h",
      "Users over quota",
      "Health",
      "Background Tasks",
      "Storage",
    ]);
    expect(wrapper.get('[data-testid="palette"]').text()).toContain(
      "Type two or more characters",
    );
    await type("z");
    expect(labels()).toEqual([]);
    expect(mocks.globalSearch).not.toHaveBeenCalled();
  });

  it.each([
    ["Create user", { path: "/users", query: { create: "1" } }],
    ["Reset a password", { path: "/users", query: { reset: "1" } }],
    ["New invitation", { path: "/invitations", query: { create: "1" } }],
    [
      "Failed tasks, last 24 h",
      { path: "/tasks", query: { status: "failed", window: "24h" } },
    ],
    ["Users over quota", { path: "/users", query: { filter: "over_quota" } }],
    ["Overview", "/"],
    ["Health", "/health"],
    ["Background Tasks", "/tasks"],
    ["Storage", "/storage"],
  ])("clicking %s goes there and closes the box", async (label, to) => {
    await open();
    const item = wrapper
      .findAll('[data-testid="palette-item"]')
      .find((n) => n.text().includes(label));
    await item.trigger("click");
    expect(mocks.router.push).toHaveBeenCalledWith(to);
    expect(wrapper.find('[data-testid="palette"]').exists()).toBe(false);
  });

  it("arrow keys move the selection (and stop at both ends); Enter opens the selected one", async () => {
    await open();
    await press("ArrowUp");
    expect(
      wrapper.findAll('[data-testid="palette-item"]')[0].classes(),
    ).toContain("selected");
    await press("ArrowDown");
    await press("ArrowDown");
    expect(
      wrapper.findAll('[data-testid="palette-item"]')[2].classes(),
    ).toContain("selected");
    await press("ArrowUp");
    expect(
      wrapper.findAll('[data-testid="palette-item"]')[1].classes(),
    ).toContain("selected");
    for (let i = 0; i < 20; i += 1) await press("ArrowDown");
    expect(
      wrapper.findAll('[data-testid="palette-item"]')[8].classes(),
    ).toContain("selected");

    await press("ArrowUp");
    await press("Enter");
    expect(mocks.router.push).toHaveBeenCalledWith("/tasks");
  });

  it("typing puts the selection back on the first match", async () => {
    await open();
    await press("ArrowDown");
    await type("o");
    expect(
      wrapper.findAll('[data-testid="palette-item"]')[0].classes(),
    ).toContain("selected");
  });

  it("ignores other keys and an empty list", async () => {
    await open();
    await press("a");
    expect(mocks.router.push).not.toHaveBeenCalled();
    await type("z");
    await press("Enter");
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("two characters switch to the search of users, repositories and commits", async () => {
    await open();
    await type("ma");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(mocks.globalSearch).toHaveBeenCalledWith(
      "admin-token",
      "ma",
      ["users", "orgs", "repos", "commits"],
      10,
    );
    expect(wrapper.find('[data-testid="palette"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("mai_lin");

    await press("Enter");
    expect(mocks.router.push).toHaveBeenCalledWith({ path: "/users", query: { open: "mai_lin" } });
  });

  it("goes back to the palette when the text is cleared", async () => {
    await open();
    await type("ma");
    await type("");
    expect(wrapper.find('[data-testid="palette"]').exists()).toBe(true);
  });

  describe("from two characters on, commands stay above the search results", () => {
    const searchFor = async (text) => {
      await type(text);
      await vi.advanceTimersByTimeAsync(300);
      await flushPromises();
    };
    const row = (n) => wrapper.findAll(".result-item")[n];

    it("shows the matching commands above the results of the search", async () => {
      await open();
      await searchFor("fail");

      expect(labels()).toEqual(["Failed tasks, last 24 h"]);
      expect(wrapper.text()).toContain("mai_lin");
      const html = wrapper.html();
      expect(html.indexOf("Failed tasks, last 24 h")).toBeLessThan(
        html.indexOf("mai_lin"),
      );
      expect(wrapper.get('[data-testid="palette"]').text()).not.toContain(
        "Type two or more characters",
      );
    });

    it("matches the typed text anywhere in the label, ignoring case", async () => {
      await open();
      await searchFor("OVER");
      expect(labels()).toEqual(["Users over quota", "Overview"]);
    });

    it("shows the commands while the search is still running", async () => {
      mocks.globalSearch.mockReset().mockImplementation(() => new Promise(() => {}));
      await open();
      await searchFor("fail");
      expect(labels()).toEqual(["Failed tasks, last 24 h"]);
      expect(wrapper.text()).toContain("Searching...");
    });

    it("keeps the commands, and no 'No results' line, when only the commands match", async () => {
      mocks.globalSearch.mockResolvedValue({ results: {} });
      await open();
      await searchFor("fail");

      expect(labels()).toEqual(["Failed tasks, last 24 h"]);
      expect(wrapper.text()).not.toContain("No results found");
    });

    it("says no results only when neither commands nor search have anything", async () => {
      mocks.globalSearch.mockResolvedValue({ results: {} });
      await open();
      await searchFor("qzx");

      expect(wrapper.find('[data-testid="palette"]').exists()).toBe(false);
      expect(wrapper.text()).toContain('No results found for "qzx"');
    });

    it("selects commands first, then the search results, with one selected index", async () => {
      await open();
      await searchFor("fail");
      expect(row(0).classes()).toContain("selected");
      expect(row(1).classes()).not.toContain("selected");

      await press("ArrowDown");
      expect(row(0).classes()).not.toContain("selected");
      expect(row(1).classes()).toContain("selected");
      expect(row(1).text()).toContain("mai_lin");

      await press("ArrowDown");
      expect(row(1).classes()).toContain("selected");
      await press("ArrowUp");
      expect(row(0).classes()).toContain("selected");
    });

    it("Enter on the selected command navigates like a click", async () => {
      await open();
      await searchFor("fail");
      await press("Enter");

      expect(mocks.router.push).toHaveBeenCalledWith({
        path: "/tasks",
        query: { status: "failed", window: "24h" },
      });
      expect(wrapper.find('[data-testid="palette"]').exists()).toBe(false);
    });

    it("Enter after moving down opens the search result instead", async () => {
      await open();
      await searchFor("fail");
      await press("ArrowDown");
      await press("Enter");
      expect(mocks.router.push).toHaveBeenCalledWith({ path: "/users", query: { open: "mai_lin" } });
    });

    it("clicking a command in the search view navigates", async () => {
      await open();
      await searchFor("fail");
      await wrapper.get('[data-testid="palette-item"]').trigger("click");
      expect(mocks.router.push).toHaveBeenCalledWith({
        path: "/tasks",
        query: { status: "failed", window: "24h" },
      });
    });

    it("keyboard works on commands alone when the search finds nothing", async () => {
      mocks.globalSearch.mockResolvedValue({ results: {} });
      await open();
      await searchFor("fail");
      await press("ArrowDown");
      await press("Enter");
      expect(mocks.router.push).toHaveBeenCalledWith({
        path: "/tasks",
        query: { status: "failed", window: "24h" },
      });
    });

    it("selects repository and commit results by the same combined index", async () => {
      mocks.globalSearch.mockResolvedValue({
        results: {
          users: [USER],
          repositories: [{ id: 3, full_id: "o/fail-repo", repo_type: "model", owner_username: "o" }],
          commits: [{ id: 4, commit_id: "abcdef123456", message: "fail", username: "o", repo_full_id: "o/fail-repo", repo_type: "model" }],
        },
      });
      await open();
      await searchFor("fail");
      await press("ArrowDown");
      await press("ArrowDown");
      expect(row(2).classes()).toContain("selected");
      expect(row(2).text()).toContain("o/fail-repo");
      await press("ArrowDown");
      expect(row(3).classes()).toContain("selected");
      await press("Enter");
      expect(mocks.router.push).toHaveBeenCalledWith({ path: "/commits", query: { repo: "model:o/fail-repo" } });
    });
  });

  describe("results open the thing itself and include organizations", () => {
    const ORG = { id: 18, username: "aurora-labs", email: null, is_org: true, has_avatar: true };
    const ORG_WITH_MAIL = { id: 19, username: "mail-org", email: "ops@mail-org.example", is_org: true, has_avatar: false };
    const REPO = { id: 3, full_id: "o/shared", repo_type: "dataset", owner_username: "o", private: true };
    const COMMIT = { id: 4, commit_id: "abcdef123456", message: "add data", username: "o", repo_full_id: "o/shared", repo_type: "dataset" };
    const results = (extra = {}) => ({ results: { users: [USER], organizations: [ORG, ORG_WITH_MAIL], repositories: [REPO], commits: [COMMIT], ...extra } });
    const rowOf = (text) => wrapper.findAll(".result-item").find((n) => n.text().includes(text));
    const search = async () => {
      await open();
      await type("lab");
      await vi.advanceTimersByTimeAsync(300);
      await flushPromises();
    };

    it("lists organizations in their own section, after the users, with a name, an email when there is one, and a picture", async () => {
      mocks.globalSearch.mockResolvedValue(results());
      await search();

      expect(wrapper.text()).toContain("Organizations (2)");
      const org = rowOf("aurora-labs");
      expect(org.text()).toContain("Organization");
      expect(org.find("img").attributes("src")).toBe("/api/organizations/aurora-labs/avatar");
      expect(rowOf("mail-org").text()).toContain("ops@mail-org.example");
      expect(rowOf("mail-org").find("img").exists()).toBe(false);
      const sections = wrapper.findAll(".section-header").map((n) => n.text());
      expect(sections.findIndex((t) => t.startsWith("Users"))).toBeLessThan(sections.findIndex((t) => t.startsWith("Organizations")));
    });

    it("shows a user's picture too, and leaves out the section when there are no organizations", async () => {
      mocks.globalSearch.mockResolvedValue(results({ organizations: [], users: [{ ...USER, has_avatar: true }] }));
      await search();

      expect(rowOf("mai_lin").find("img").attributes("src")).toBe("/api/users/mai_lin/avatar");
      expect(wrapper.text()).not.toContain("Organizations (");
    });

    it("opens an organization like a user, a repository with its type, and a commit's repository", async () => {
      mocks.globalSearch.mockResolvedValue(results());
      await search();

      await rowOf("aurora-labs").trigger("click");
      expect(mocks.router.push).toHaveBeenLastCalledWith({ path: "/users", query: { open: "aurora-labs" } });

      await search();
      await rowOf("o/shared").trigger("click");
      expect(mocks.router.push).toHaveBeenLastCalledWith({ path: "/repositories", query: { q: "o/shared", open: "dataset:o/shared" } });

      await search();
      await rowOf("add data").trigger("click");
      expect(mocks.router.push).toHaveBeenLastCalledWith({ path: "/commits", query: { repo: "dataset:o/shared" } });
    });

    it("shows all commits for a commit that has no repository", async () => {
      mocks.globalSearch.mockResolvedValue(results({ commits: [{ ...COMMIT, repo_full_id: null }] }));
      await search();
      await rowOf("add data").trigger("click");

      expect(mocks.router.push).toHaveBeenLastCalledWith({ path: "/commits" });
    });

    it("walks users, organizations, repositories and commits by one index, and Enter opens an organization", async () => {
      mocks.globalSearch.mockResolvedValue(results());
      await search();
      const labels = () => wrapper.findAll(".result-item").filter((n) => !n.attributes("data-testid")).map((n) => n.find(".result-label").text());

      expect(labels()).toEqual(["mai_lin", "aurora-labs", "mail-org", "o/shared", "add data"]);
      for (let i = 0; i < 9; i++) await press("ArrowDown"); // stops on the last row, the commit
      for (let i = 0; i < 3; i++) await press("ArrowUp"); // commit, repository, mail-org, aurora-labs
      await press("Enter");
      expect(mocks.router.push).toHaveBeenLastCalledWith({ path: "/users", query: { open: "aurora-labs" } });
    });

    it("asks for the organization in its placeholder, and does not announce the navigation with a toast", async () => {
      mocks.globalSearch.mockResolvedValue(results());
      await search();

      expect(wrapper.get("input").attributes("placeholder")).toContain("organizations");
      await rowOf("aurora-labs").trigger("click");
      expect(document.body.textContent).not.toContain("Navigate to");
    });
  });
});
