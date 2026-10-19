import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElForm, ElFormItem } from "element-plus";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  adminStore: { token: "admin-token", logout: vi.fn() },
  listUsers: vi.fn(),
  createUser: vi.fn(),
}));

const routeState = vi.hoisted(() => ({ query: {} }));
vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
  useRoute: () => routeState,
}));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.adminStore }));
vi.mock("@/utils/api", () => ({
  listUsers: (...args) => mocks.listUsers(...args),
  getUserInfo: vi.fn(),
  createUser: (...args) => mocks.createUser(...args),
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

let wrapper;

async function openDialog() {
  wrapper = mount(UsersPage, {
    attachTo: document.body,
    global: {
      components: { ElForm, ElFormItem },
      stubs: {
        ...ElementPlusStubs,
        ElForm: false,
        ElFormItem: false,
        ElInput: InputStub,
        ElDescriptions: true,
        ElDescriptionsItem: true,
        ElDivider: true,
      },
      directives: { loading: {} },
    },
  });
  await flushPromises();
  await wrapper
    .findAll("button")
    .find((button) => button.text().includes("Create User"))
    .trigger("click");
  await flushPromises();
}

// Element Plus shows a validation message 100 ms after the state turns to error.
const settleMessages = () => new Promise((resolve) => setTimeout(resolve, 150));
const dialog = () => wrapper.get('[data-el-dialog="true"]');
const field = (placeholder) =>
  dialog().get(`input[placeholder="${placeholder}"]`);
const submit = async () => {
  await dialog()
    .findAll("button")
    .find((button) => button.text().includes("Create User"))
    .trigger("click");
  await flushPromises();
  await settleMessages();
};

describe("creating a user from the admin portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminStore.token = "admin-token";
    mocks.listUsers.mockResolvedValue({ users: [], total: 0 });
    mocks.createUser.mockResolvedValue({});
  });
  afterEach(() => wrapper?.unmount());

  it("refuses an empty form and says which fields are missing", async () => {
    await openDialog();
    await submit();

    expect(mocks.createUser).not.toHaveBeenCalled();
    const text = dialog().text();
    expect(text).toContain("Username is required");
    expect(text).toContain("Email is required");
    expect(text).toContain("Password is required");
    expect(dialog().exists()).toBe(true); // the dialog stays open for correction
  });

  it("treats blanks as missing and rejects a malformed e-mail address", async () => {
    await openDialog();
    await field("Enter username").setValue("   ");
    await field("Enter email").setValue("not-an-email");
    await field("Enter password").setValue("secret");
    await submit();

    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(dialog().text()).toContain("Username is required");
    expect(dialog().text()).toContain("Enter a valid e-mail address");
    expect(dialog().text()).not.toContain("Password is required");
  });

  it("creates the user once every required field is valid, then closes", async () => {
    await openDialog();
    await field("Enter username").setValue("ada");
    await field("Enter email").setValue("ada@example.dev");
    await field("Enter password").setValue("secret");
    await submit();

    expect(mocks.createUser).toHaveBeenCalledOnce();
    expect(mocks.createUser.mock.calls[0][1]).toMatchObject({
      username: "ada",
      email: "ada@example.dev",
      password: "secret",
    });
    expect(wrapper.find('[data-el-dialog="true"]').exists()).toBe(false);
  });

  it("starts the next dialog without the previous error messages", async () => {
    await openDialog();
    await submit();
    expect(dialog().text()).toContain("Username is required");

    await wrapper.vm.$.setupState.resetForm();
    await flushPromises();
    await settleMessages();
    expect(dialog().text()).not.toContain("Username is required");
  });
});
