import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ElMessageBox } from "element-plus";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  adminStore: { token: "admin-token" },
  api: {
    createRegisterInvitation: vi.fn(),
    listInvitations: vi.fn(),
    deleteInvitation: vi.fn(),
  },
}));

const routeState = vi.hoisted(() => ({ query: {} }));
vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
  useRoute: () => routeState,
}));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.adminStore }));
vi.mock("@/utils/api", () => ({ ...mocks.api }));
vi.mock("@/components/AdminLayout.vue", () => ({
  default: defineComponent({
    setup(_, { slots }) {
      return () => h("main", slots.default ? slots.default() : []);
    },
  }),
}));

import InvitationsPage from "@/pages/invitations.vue";

async function mountPage() {
  const wrapper = mount(InvitationsPage, {
    global: { stubs: ElementPlusStubs, directives: { loading: {} } },
  });
  await flushPromises();
  return wrapper;
}

describe("invitations list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("says once that there is nothing, instead of an empty table plus a second notice", async () => {
    mocks.api.listInvitations.mockResolvedValue({ invitations: [] });
    const wrapper = await mountPage();

    expect(wrapper.findAll("[data-el-empty]")).toHaveLength(1);
    expect(wrapper.get("[data-el-empty]").attributes("data-description")).toBe(
      "No invitations found",
    );
    expect(wrapper.find("[data-el-table]").exists()).toBe(false);
    wrapper.unmount();
  });

  it("shows the table, and no notice, once there are invitations", async () => {
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
    const wrapper = await mountPage();

    expect(wrapper.find("[data-el-table]").exists()).toBe(true);
    expect(wrapper.find("[data-el-empty]").exists()).toBe(false);
    wrapper.unmount();
  });
});

describe("invitations opened from the Overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.listInvitations.mockResolvedValue({ invitations: [] });
  });
  afterEach(() => {
    routeState.query = {};
  });

  it("create=1 opens the create dialog", async () => {
    routeState.query = { create: "1" };
    const wrapper = await mountPage();
    expect(wrapper.findAll("[data-el-dialog]").length).toBeGreaterThan(0);
    wrapper.unmount();
  });

  it("opens no dialog otherwise", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find("[data-el-dialog]").exists()).toBe(false);
    wrapper.unmount();
  });
});

describe("an invitation that can be used without limit", () => {
  const invitation = (extra) => ({
    id: 1,
    token: "abc",
    action: "join_org",
    org_id: 3,
    role: "member",
    created_at: "2026-01-01T00:00:00Z",
    usage_count: 3,
    ...extra,
  });
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    routeState.query = {};
  });

  it("is the symbol in the table, a number when there is a limit", async () => {
    mocks.api.listInvitations.mockResolvedValue({
      invitations: [
        invitation({ id: 1, is_reusable: true, max_usage: -1 }),
        invitation({ id: 2, is_reusable: true, max_usage: 5 }),
      ],
    });
    const wrapper = await mountPage();

    expect(wrapper.findAll('[role="img"][aria-label="No limit"]')).toHaveLength(
      1,
    );
    const text = wrapper.text().replace(/\s+/g, " ");
    expect(text).toContain("\u221e");
    expect(text).toContain("5");
    wrapper.unmount();
  });

  it("counts as a single use when no maximum was set", async () => {
    mocks.api.listInvitations.mockResolvedValue({
      invitations: [invitation({ is_reusable: true, max_usage: null })],
    });
    const wrapper = await mountPage();

    expect(wrapper.find('[role="img"]').exists()).toBe(false);
    expect(wrapper.text().replace(/\s+/g, " ")).toContain("3 / 1");
    const confirm = vi
      .spyOn(ElMessageBox, "confirm")
      .mockRejectedValue("cancel");
    await wrapper.vm.handleDeleteInvitation(
      invitation({ is_reusable: false, max_usage: null }),
    );
    expect(confirm.mock.calls[0][0]).toContain("Usage: 3 / 1");
    confirm.mockRestore();
    wrapper.unmount();
  });

  it("is explained with the symbol and its word, in the help and in the list of usages", async () => {
    mocks.api.listInvitations.mockResolvedValue({ invitations: [] });
    routeStateCreate();
    const wrapper = await mountPage();

    const text = wrapper.text().replace(/\s+/g, " ");
    expect(text).toContain("\u221e No limit: Can be used without limit");
    expect(wrapper.findAll("option").map((option) => option.text())).toContain(
      "\u221e No limit",
    );
    wrapper.unmount();
  });

  it("is written with the symbol where the deletion asks to be confirmed", async () => {
    mocks.api.listInvitations.mockResolvedValue({ invitations: [] });
    const confirm = vi
      .spyOn(ElMessageBox, "confirm")
      .mockRejectedValue("cancel");
    const wrapper = await mountPage();

    await wrapper.vm.handleDeleteInvitation(
      invitation({ is_reusable: true, max_usage: -1 }),
    );
    expect(confirm.mock.calls[0][0]).toContain("Usage: 3 / \u221e");
    await wrapper.vm.handleDeleteInvitation(
      invitation({ is_reusable: true, max_usage: 5 }),
    );
    expect(confirm.mock.calls[1][0]).toContain("Usage: 3 / 5");
    confirm.mockRestore();
    wrapper.unmount();
  });
});

function routeStateCreate() {
  routeState.query = { create: "1" };
}
