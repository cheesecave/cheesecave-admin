import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  adminStore: { token: "admin-token", logout: vi.fn() },
  api: {
    listUsers: vi.fn(),
    getUserInfo: vi.fn(),
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    setEmailVerification: vi.fn(),
    updateUserQuota: vi.fn(),
    listRepositories: vi.fn(),
    getRepositoryDetails: vi.fn(),
    getRepositoryStorageBreakdown: vi.fn(),
    recalculateAllRepoStorage: vi.fn(),
    listCommits: vi.fn(),
    deleteRepositoryAdmin: vi.fn(),
    moveRepositoryAdmin: vi.fn(),
    squashRepositoryAdmin: vi.fn(),
    getSiteConfig: vi.fn(),
    createRegisterInvitation: vi.fn(),
    listInvitations: vi.fn(),
    deleteInvitation: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
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
  default: defineComponent({ setup: () => () => h("div") }),
}));

import UsersPage from "@/pages/users.vue";
import RepositoriesPage from "@/pages/repositories.vue";
import InvitationsPage from "@/pages/invitations.vue";

const pages = [
  ["users", UsersPage],
  ["repositories", RepositoriesPage],
  ["invitations", InvitationsPage],
];

function viewport(compact) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query) => ({
      matches: compact && query === "(max-width: 768px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

async function mountPage(page, compact) {
  viewport(compact);
  const wrapper = mount(page, {
    global: { stubs: ElementPlusStubs, directives: { loading: {} } },
  });
  await flushPromises();
  return wrapper;
}

const actionsCell = (wrapper) => wrapper.get('td[data-col-label="Actions"]');

describe("admin tables on a phone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.listUsers.mockResolvedValue({
      users: [{ id: 1, username: "ada", email: "ada@example.dev" }],
      total: 1,
    });
    mocks.api.listRepositories.mockResolvedValue({
      repositories: [
        {
          id: 1,
          repo_type: "model",
          namespace: "owner",
          name: "demo",
          full_id: "owner/demo",
          owner_username: "owner",
          used_bytes: 0,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      total: 1,
    });
    mocks.api.getSiteConfig.mockResolvedValue({ capabilities: {} });
    mocks.api.listInvitations.mockResolvedValue({
      invitations: [
        {
          id: 1,
          token: "abc",
          action: "register_account",
          created_at: "2026-01-01T00:00:00Z",
          usage_count: 0,
          max_usage: 1,
        },
      ],
    });
  });

  it.each(pages)(
    "%s keeps the Actions column pinned on a wide screen",
    async (_, page) => {
      const wrapper = await mountPage(page, false);
      expect(actionsCell(wrapper).attributes("data-fixed")).toBe("right");
      wrapper.unmount();
    },
  );

  it.each(pages)(
    "%s lets the whole table scroll on a phone instead of pinning Actions over it",
    async (_, page) => {
      const wrapper = await mountPage(page, true);
      expect(actionsCell(wrapper).attributes("data-fixed")).toBe("false");
      wrapper.unmount();
    },
  );

  it.each([
    ["repositories", RepositoriesPage],
    ["invitations", InvitationsPage],
  ])(
    "%s wraps its filter bar instead of overflowing the card",
    async (_, page) => {
      const wrapper = await mountPage(page, true);
      const bar = wrapper
        .findAll(".flex")
        .find((node) => /Apply Filters|Filter by Type/.test(node.text()));
      expect(bar.classes()).toContain("flex-wrap");
      wrapper.unmount();
    },
  );
});
