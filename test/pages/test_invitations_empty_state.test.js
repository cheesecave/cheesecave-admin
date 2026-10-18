import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
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
