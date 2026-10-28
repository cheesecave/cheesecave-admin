import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  adminStore: { token: "admin-token", logout: vi.fn() },
  listUsers: vi.fn(),
  getPasswordResetStatus: vi.fn(),
  getUserInfo: vi.fn(),
}));

const routeState = vi.hoisted(() => ({ query: {} }));
vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
  useRoute: () => routeState,
}));
vi.mock("@/stores/admin", () => ({
  useAdminStore: () => mocks.adminStore,
}));
vi.mock("@/utils/api", () => ({
  listUsers: (...args) => mocks.listUsers(...args),
  getUserInfo: (...args) => mocks.getUserInfo(...args),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  setEmailVerification: vi.fn(),
  updateUserQuota: vi.fn(),
  getPasswordResetStatus: (...args) => mocks.getPasswordResetStatus(...args),
  createPasswordResetLink: vi.fn(),
  revokePasswordResetLink: vi.fn(),
  formatBytes: (bytes) => String(bytes),
}));
vi.mock("@/components/AdminLayout.vue", () => ({
  default: defineComponent({
    setup(_, { slots }) {
      return () => h("div", slots.default?.());
    },
  }),
}));

import UsersPage from "@/pages/users.vue";

const InputStub = defineComponent({
  ...ElementPlusStubs.ElInput,
  emits: ["update:modelValue", "change", "input", "clear"],
});

const SwitchStub = defineComponent({
  name: "ElSwitch",
  props: { modelValue: Boolean },
  emits: ["update:modelValue", "change"],
  setup(props, { emit }) {
    return () =>
      h("input", {
        type: "checkbox",
        "data-testid": "show-organizations",
        checked: props.modelValue,
        onChange: (event) => {
          emit("update:modelValue", event.target.checked);
          emit("change", event.target.checked);
        },
      });
  },
});

function user(id, isOrg = false) {
  return {
    id,
    username: isOrg ? `org-${id}` : `user-${id}`,
    is_org: isOrg,
    created_at: "2026-01-01T00:00:00Z",
  };
}

function mountPage() {
  return mount(UsersPage, {
    global: {
      stubs: {
        ...ElementPlusStubs,
        ElInput: InputStub,
        ElSwitch: SwitchStub,
        ElDescriptions: true,
        ElDescriptionsItem: true,
        ElDivider: true,
      },
      directives: { loading: {} },
    },
  });
}

async function goToPage(wrapper, page) {
  const pagination = wrapper.getComponent(ElementPlusStubs.ElPagination);
  pagination.vm.$emit("update:currentPage", page);
  pagination.vm.$emit("current-change", page);
  await flushPromises();
}

describe("admin user management pagination", () => {
  let wrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminStore.token = "admin-token";
    mocks.listUsers.mockResolvedValue({ users: [user(1)], total: 1 });
  });

  afterEach(() => {
    wrapper?.unmount();
    vi.useRealTimers();
  });

  it("keeps users reachable when organizations make the list exceed one page", async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) =>
      user(index + 6, true),
    );
    mocks.listUsers.mockResolvedValueOnce({ users: firstPage, total: 21 });
    mocks.listUsers.mockResolvedValueOnce({ users: [user(5)], total: 21 });

    wrapper = mountPage();
    await flushPromises();

    expect(mocks.listUsers).toHaveBeenCalledWith("admin-token", {
      search: undefined,
      limit: 20,
      offset: 0,
      include_orgs: true,
    });
    expect(
      wrapper.getComponent(ElementPlusStubs.ElPagination).props("total"),
    ).toBe(21);

    await goToPage(wrapper, 2);

    expect(mocks.listUsers).toHaveBeenLastCalledWith("admin-token", {
      search: undefined,
      limit: 20,
      offset: 20,
      include_orgs: true,
    });
    expect(wrapper.get('[data-col-label="ID"]').text()).toBe("5");
    expect(wrapper.text()).toContain("user-5");
  });

  it("returns to the first page when toggling organizations", async () => {
    mocks.listUsers.mockResolvedValue({ users: [user(5)], total: 21 });
    wrapper = mountPage();
    await flushPromises();
    await goToPage(wrapper, 2);

    await wrapper.get('[data-testid="show-organizations"]').setValue(false);
    await flushPromises();

    expect(mocks.listUsers).toHaveBeenLastCalledWith("admin-token", {
      search: undefined,
      limit: 20,
      offset: 0,
      include_orgs: false,
    });
    expect(
      wrapper.getComponent(ElementPlusStubs.ElPagination).props("currentPage"),
    ).toBe(1);
  });

  it("returns to the first page when searching or clearing a search", async () => {
    vi.useFakeTimers();
    mocks.listUsers.mockResolvedValue({ users: [user(5)], total: 21 });
    wrapper = mountPage();
    await flushPromises();
    await goToPage(wrapper, 2);

    const search = wrapper.getComponent(InputStub);
    await search.get("input").setValue("user-5");
    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();
    expect(mocks.listUsers).toHaveBeenLastCalledWith("admin-token", {
      search: "user-5",
      limit: 20,
      offset: 0,
      include_orgs: true,
    });

    await goToPage(wrapper, 2);
    search.vm.$emit("clear");
    await flushPromises();
    expect(mocks.listUsers).toHaveBeenLastCalledWith("admin-token", {
      search: undefined,
      limit: 20,
      offset: 0,
      include_orgs: true,
    });
  });

  it("cancels the pending search request when clearing the input", async () => {
    vi.useFakeTimers();
    wrapper = mountPage();
    await flushPromises();

    const search = wrapper.getComponent(InputStub);
    await search.get("input").setValue("user-5");
    search.vm.$emit("clear");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(500);

    expect(mocks.listUsers).toHaveBeenCalledTimes(2);
    expect(mocks.listUsers).toHaveBeenLastCalledWith("admin-token", {
      search: undefined,
      limit: 20,
      offset: 0,
      include_orgs: true,
    });
  });

  it("returns to a valid page when the last page becomes empty", async () => {
    mocks.listUsers.mockResolvedValueOnce({ users: [user(1)], total: 21 });
    mocks.listUsers.mockResolvedValueOnce({ users: [], total: 20 });
    mocks.listUsers.mockResolvedValueOnce({ users: [user(1)], total: 20 });
    wrapper = mountPage();
    await flushPromises();

    await goToPage(wrapper, 2);

    expect(mocks.listUsers).toHaveBeenCalledTimes(3);
    expect(mocks.listUsers).toHaveBeenLastCalledWith("admin-token", {
      search: undefined,
      limit: 20,
      offset: 0,
      include_orgs: true,
    });
    expect(wrapper.text()).toContain("user-1");
    expect(wrapper.text()).not.toContain("No users found");
  });

  it("does not show pagination for a single page", async () => {
    wrapper = mountPage();
    await flushPromises();

    expect(wrapper.findComponent(ElementPlusStubs.ElPagination).exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain("user-1");
  });
});

describe("admin user password reset action", () => {
  let wrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminStore.token = "admin-token";
    mocks.listUsers.mockResolvedValue({
      users: [user(1), user(2, true)],
      total: 2,
    });
    mocks.getPasswordResetStatus.mockResolvedValue({
      active: false,
      default: "1h",
      choices: [{ key: "1h", seconds: 3600, label: "1 hour" }],
    });
  });

  afterEach(() => wrapper?.unmount());

  it("offers Reset password for users, not organizations, and opens the dialog", async () => {
    wrapper = mountPage();
    await flushPromises();

    const resets = wrapper
      .findAll("button")
      .filter((b) => b.text().includes("Reset password"));
    expect(resets).toHaveLength(1);
    expect(wrapper.find('[data-title="Reset password for user-1"]').exists()).toBe(
      false,
    );

    await resets[0].trigger("click");
    await flushPromises();

    expect(mocks.getPasswordResetStatus).toHaveBeenCalledWith(
      "admin-token",
      "user-1",
    );
    expect(wrapper.find('[data-title="Reset password for user-1"]').exists()).toBe(
      true,
    );
  });
});

describe("admin users opened from the Overview", () => {
  const G = 1_000_000_000;
  const withQuota = (id, name, used, quota, extra = {}) => ({
    ...user(id),
    username: name,
    private_used_bytes: used,
    private_quota_bytes: quota,
    public_used_bytes: 0,
    public_quota_bytes: null,
    ...extra,
  });
  let wrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminStore.token = "admin-token";
    mocks.router.replace.mockReset();
    mocks.listUsers.mockResolvedValue({
      users: [
        withQuota(1, "within", 10 * G, 50 * G),
        withQuota(2, "over-private", 60 * G, 50 * G),
        withQuota(3, "unlimited", 900 * G, null),
        withQuota(4, "over-public", 0, null, {
          public_used_bytes: 20 * G,
          public_quota_bytes: 10 * G,
        }),
      ],
      total: 4,
    });
  });
  afterEach(() => {
    wrapper?.unmount();
    routeState.query = {};
  });

  it("lists everyone when opened plainly", async () => {
    routeState.query = {};
    wrapper = mountPage();
    await flushPromises();
    expect(wrapper.find('[data-testid="deep-link-banner"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("within");
    expect(wrapper.text()).toContain("unlimited");
  });

  it("filter=over_quota shows only users over a private or public quota, and says so", async () => {
    routeState.query = { filter: "over_quota" };
    wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('[data-testid="deep-link-banner"]').text()).toContain(
      "over their storage quota",
    );
    expect(wrapper.text()).toContain("over-private");
    expect(wrapper.text()).toContain("over-public");
    expect(wrapper.text()).not.toContain("within");
    expect(wrapper.text()).not.toContain("unlimited");
  });

  it("dismissing the banner shows everyone again and drops the parameter", async () => {
    routeState.query = { filter: "over_quota" };
    wrapper = mountPage();
    await flushPromises();

    wrapper.getComponent(ElementPlusStubs.ElAlert).vm.$emit("close");
    await flushPromises();

    expect(mocks.router.replace).toHaveBeenCalledWith({ path: "/users" });
    expect(wrapper.find('[data-testid="deep-link-banner"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("within");
  });

  it("reset=1 hints at what to do next, and dismisses the same way", async () => {
    routeState.query = { reset: "1" };
    wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('[data-testid="deep-link-banner"]').text()).toContain(
      "choose Reset password on their row",
    );
    wrapper.getComponent(ElementPlusStubs.ElAlert).vm.$emit("close");
    await flushPromises();
    expect(mocks.router.replace).toHaveBeenCalledWith({ path: "/users" });
    expect(wrapper.find('[data-testid="deep-link-banner"]').exists()).toBe(false);
  });

  it("create=1 opens the create dialog", async () => {
    routeState.query = { create: "1" };
    wrapper = mountPage();
    await flushPromises();
    expect(wrapper.find('[data-el-dialog="true"][data-title="Create New User"]').exists()).toBe(true);
  });
});

describe("a quota with no limit", () => {
  let wrapper;
  const passthrough = (name) =>
    defineComponent({
      name,
      setup:
        (_, { slots }) =>
        () =>
          h("div", slots.default?.()),
    });
  const mountWithDescriptions = () =>
    mount(UsersPage, {
      global: {
        stubs: {
          ...ElementPlusStubs,
          ElInput: InputStub,
          ElSwitch: SwitchStub,
          ElDescriptions: passthrough("ElDescriptions"),
          ElDescriptionsItem: passthrough("ElDescriptionsItem"),
          ElDivider: true,
        },
        directives: { loading: {} },
      },
    });
  const noLimit = {
    ...user(7),
    username: "noah",
    private_quota_bytes: null,
    public_quota_bytes: null,
    private_used_bytes: 1000,
    public_used_bytes: 2000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminStore.token = "admin-token";
    mocks.listUsers.mockResolvedValue({ users: [noLimit], total: 1 });
    mocks.getUserInfo.mockResolvedValue(noLimit);
  });
  afterEach(() => wrapper?.unmount());

  it("is the symbol to the right of the slash in the list, named for a screen reader", async () => {
    wrapper = mountWithDescriptions();
    await flushPromises();

    const symbols = wrapper.findAll('[role="img"][aria-label="No limit"]');
    expect(symbols).toHaveLength(2);
    expect(wrapper.text().replace(/\s+/g, " ")).toContain("1000 / \u221e");
  });

  it("has its word beside it where the details show only the quota", async () => {
    wrapper = mountWithDescriptions();
    await flushPromises();
    await wrapper.vm.handleViewUser(noLimit);
    await flushPromises();

    expect(wrapper.text()).toContain("\u221e No limit");
  });

  it("fills the quota inputs with the symbol and says that the words work too", async () => {
    wrapper = mountWithDescriptions();
    await flushPromises();
    await wrapper.vm.handleViewUser(noLimit);
    wrapper.vm.openQuotaDialog();
    await flushPromises();

    expect(wrapper.vm.quotaInputPrivate).toBe("\u221e");
    expect(wrapper.vm.quotaInputPublic).toBe("\u221e");
    const text = wrapper.text().replace(/\s+/g, " ");
    expect(text).toContain('or "\u221e" ("no limit" and "unlimited" work too)');
    expect(wrapper.vm.formatBytesDecimal(null)).toBe("\u221e");
    expect(wrapper.vm.formatBytesDecimal(5_000_000_000)).toBe("5.00 GB");
    const placeholders = wrapper
      .findAll("input")
      .map((input) => input.attributes("placeholder"));
    expect(placeholders).toContain("e.g., 10G, 500MB, \u221e");
  });

  it("is set by the quick button, whose label has the word", async () => {
    wrapper = mountWithDescriptions();
    await flushPromises();
    await wrapper.vm.handleViewUser({
      ...noLimit,
    });
    mocks.getUserInfo.mockResolvedValue({
      ...noLimit,
      private_quota_bytes: 5_000_000_000,
      public_quota_bytes: 5_000_000_000,
    });
    await wrapper.vm.handleViewUser(noLimit);
    wrapper.vm.openQuotaDialog();
    await flushPromises();
    expect(wrapper.vm.quotaInputPublic).toBe("5.00 GB");

    const buttons = wrapper
      .findAll("button")
      .filter((button) => button.text() === "\u221e No limit");
    expect(buttons).toHaveLength(2);
    await buttons[0].trigger("click");
    expect(wrapper.vm.quotaInputPublic).toBe("\u221e");
    expect(wrapper.vm.quotaForm.public_quota_bytes).toBeNull();
    await buttons[1].trigger("click");
    expect(wrapper.vm.quotaInputPrivate).toBe("\u221e");
    expect(wrapper.vm.quotaForm.private_quota_bytes).toBeNull();
  });

  it.each(["\u221e", "unlimited", "Unlimited", "no limit", "null"])(
    "is read from %j typed into the input",
    async (typed) => {
      wrapper = mountWithDescriptions();
      await flushPromises();
      await wrapper.vm.handleViewUser(noLimit);
      wrapper.vm.openQuotaDialog();
      wrapper.vm.quotaInputPublic = "10G";
      wrapper.vm.updateQuotaFromInput("public");
      expect(wrapper.vm.quotaForm.public_quota_bytes).toBe(10_000_000_000);

      wrapper.vm.quotaInputPublic = typed;
      wrapper.vm.updateQuotaFromInput("public");
      expect(wrapper.vm.quotaForm.public_quota_bytes).toBeNull();
    },
  );
});
