import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  adminStore: { token: "admin-token", logout: vi.fn() },
  listUsers: vi.fn(),
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/stores/admin", () => ({
  useAdminStore: () => mocks.adminStore,
}));
vi.mock("@/utils/api", () => ({
  listUsers: (...args) => mocks.listUsers(...args),
  getUserInfo: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  setEmailVerification: vi.fn(),
  updateUserQuota: vi.fn(),
  formatBytes: (bytes) => String(bytes ?? "Unlimited"),
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
