import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  adminStore: { token: "admin-token", logout: vi.fn() },
  listUsers: vi.fn(),
  deleteUser: vi.fn(),
  confirm: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.adminStore }));
vi.mock("@/utils/api", () => ({
  listUsers: mocks.listUsers,
  deleteUser: mocks.deleteUser,
  getUserInfo: vi.fn(),
  createUser: vi.fn(),
  setEmailVerification: vi.fn(),
  updateUserQuota: vi.fn(),
  formatBytes: (value) => `${value ?? 0} B`,
}));
vi.mock("@/components/AdminLayout.vue", () => ({
  default: defineComponent({
    setup(_, { slots }) {
      return () => h("main", slots.default?.());
    },
  }),
}));
import UsersPage from "@/pages/users.vue";

describe("admin user deletion error branches", () => {
  const wrappers = [];
  beforeEach(async () => {
    vi.resetAllMocks();
    mocks.listUsers.mockResolvedValue({ users: [], total: 0 });
    const elementPlus = await vi.importActual("element-plus");
    vi.spyOn(elementPlus.ElMessage, "error").mockImplementation(mocks.error);
    vi.spyOn(elementPlus.ElMessage, "success").mockImplementation(
      mocks.success,
    );
    vi.spyOn(elementPlus.ElMessageBox, "confirm").mockImplementation(
      mocks.confirm,
    );
  });
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    vi.restoreAllMocks();
  });
  async function start() {
    const wrapper = mount(UsersPage, {
      global: {
        stubs: ElementPlusStubs,
        directives: { loading: { mounted() {}, updated() {} } },
      },
    });
    wrappers.push(wrapper);
    await flushPromises();
    return wrapper;
  }

  it("parses ordinary nested delete errors without entering the force-delete path", async () => {
    mocks.confirm.mockResolvedValueOnce("confirm");
    mocks.deleteUser.mockRejectedValueOnce({
      response: {
        data: { detail: { error: { message: "Account is locked" } } },
      },
    });
    const wrapper = await start();
    await wrapper.vm.handleDeleteUser({ username: "alice" });
    expect(mocks.error).toHaveBeenCalledWith("Account is locked");
    expect(mocks.confirm).toHaveBeenCalledOnce();
    expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith(
      "admin-token",
      "alice",
      false,
    );
  });

  it("retains owned_repositories confirmation and only forces deletion after confirmation", async () => {
    mocks.confirm
      .mockResolvedValueOnce("confirm")
      .mockResolvedValueOnce("confirm");
    mocks.deleteUser
      .mockRejectedValueOnce({
        response: {
          data: {
            detail: {
              owned_repositories: ["alice/model"],
              error: { message: "User owns repositories" },
            },
          },
        },
      })
      .mockResolvedValueOnce({});
    const wrapper = await start();
    await wrapper.vm.handleDeleteUser({ username: "alice" });
    expect(mocks.confirm.mock.calls[1][0]).toContain("alice/model");
    expect(mocks.confirm.mock.calls[1][1]).toBe("Force Delete Required");
    expect(mocks.deleteUser.mock.calls).toEqual([
      ["admin-token", "alice", false],
      ["admin-token", "alice", true],
    ]);
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith(
      "User and repositories deleted; storage cleanup scheduled (see Background Tasks)",
    );
  });

  it.each(["cancel", "close"])(
    "keeps %s of force-delete confirmation silent",
    async (reason) => {
      mocks.confirm
        .mockResolvedValueOnce("confirm")
        .mockRejectedValueOnce(reason);
      mocks.deleteUser.mockRejectedValueOnce({
        response: { data: { detail: { owned_repositories: ["alice/model"] } } },
      });
      const wrapper = await start();
      await wrapper.vm.handleDeleteUser({ username: "alice" });
      expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith(
        "admin-token",
        "alice",
        false,
      );
      expect(mocks.error).not.toHaveBeenCalled();
      expect(mocks.success).not.toHaveBeenCalled();
    },
  );
});
