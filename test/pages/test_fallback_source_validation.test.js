import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElForm, ElFormItem } from "element-plus";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  adminStore: { token: "admin-token" },
  api: {
    listFallbackSources: vi.fn(),
    createFallbackSource: vi.fn(),
    updateFallbackSource: vi.fn(),
    getFallbackCacheStats: vi.fn(),
    listUsers: vi.fn(),
    listRepositories: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.adminStore }));
vi.mock("@/utils/api", () => ({
  listFallbackSources: (...a) => mocks.api.listFallbackSources(...a),
  createFallbackSource: (...a) => mocks.api.createFallbackSource(...a),
  updateFallbackSource: (...a) => mocks.api.updateFallbackSource(...a),
  deleteFallbackSource: vi.fn(),
  getFallbackCacheStats: (...a) => mocks.api.getFallbackCacheStats(...a),
  clearFallbackCache: vi.fn(),
  invalidateFallbackRepoCache: vi.fn(),
  invalidateFallbackUserCacheById: vi.fn(),
  invalidateFallbackUserCacheByUsername: vi.fn(),
  listUsers: (...a) => mocks.api.listUsers(...a),
  listRepositories: (...a) => mocks.api.listRepositories(...a),
  bulkReplaceFallbackSources: vi.fn(),
  runFallbackProbe: vi.fn(),
  runFallbackChainSimulate: vi.fn(),
}));
vi.mock("@/components/AdminLayout.vue", () => ({
  default: defineComponent({
    setup(_, { slots }) {
      return () => h("div", slots.default?.());
    },
  }),
}));

import FallbackSourcesPage from "@/pages/fallback-sources.vue";

const InputStub = defineComponent({
  ...ElementPlusStubs.ElInput,
  emits: ["update:modelValue", "change", "input", "clear"],
});

const source = {
  id: 7,
  namespace: "",
  url: "https://huggingface.co",
  token: "",
  priority: 100,
  name: "HuggingFace",
  source_type: "huggingface",
  enabled: true,
};

let wrapper;
const settleMessages = () => new Promise((resolve) => setTimeout(resolve, 150));

async function mountPage() {
  wrapper = mount(FallbackSourcesPage, {
    attachTo: document.body,
    global: {
      components: { ElForm, ElFormItem },
      stubs: {
        ...ElementPlusStubs,
        ElForm: false,
        ElFormItem: false,
        ElInput: InputStub,
      },
      directives: { loading: {} },
    },
  });
  await flushPromises();
}

const dialog = () => wrapper.get('[data-el-dialog="true"]');
const button = (root, label) =>
  root.findAll("button").find((b) => b.text().trim() === label);

async function open(label) {
  await button(wrapper, label).trigger("click");
  await flushPromises();
}
async function submit(label) {
  await button(dialog(), label).trigger("click");
  await flushPromises();
  await settleMessages();
}

describe("saving a fallback source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.listFallbackSources.mockResolvedValue([source]);
    mocks.api.getFallbackCacheStats.mockResolvedValue({});
    mocks.api.listUsers.mockResolvedValue({ users: [], total: 0 });
    mocks.api.listRepositories.mockResolvedValue({
      repositories: [],
      total: 0,
    });
    mocks.api.createFallbackSource.mockResolvedValue({});
    mocks.api.updateFallbackSource.mockResolvedValue({});
  });
  afterEach(() => wrapper?.unmount());

  it("refuses a source without a name or URL", async () => {
    await mountPage();
    await open("Add Source");
    await submit("Create");

    expect(mocks.api.createFallbackSource).not.toHaveBeenCalled();
    expect(dialog().text()).toContain("Name is required");
    expect(dialog().text()).toContain("URL is required");
  });

  it("refuses a URL that is not http or https", async () => {
    await mountPage();
    await open("Add Source");
    await dialog().get('input[placeholder="HuggingFace"]').setValue("Mirror");
    await dialog()
      .get('input[placeholder="https://huggingface.co"]')
      .setValue("huggingface.co");
    await submit("Create");

    expect(mocks.api.createFallbackSource).not.toHaveBeenCalled();
    expect(dialog().text()).toContain("Enter an http:// or https:// URL");
    expect(dialog().text()).not.toContain("Name is required");
  });

  it("creates the source once name and URL are valid", async () => {
    await mountPage();
    await open("Add Source");
    await dialog().get('input[placeholder="HuggingFace"]').setValue("Mirror");
    await dialog()
      .get('input[placeholder="https://huggingface.co"]')
      .setValue("https://mirror.example.dev");
    await submit("Create");

    expect(mocks.api.createFallbackSource).toHaveBeenCalledOnce();
    expect(mocks.api.createFallbackSource.mock.calls[0][1]).toMatchObject({
      name: "Mirror",
      url: "https://mirror.example.dev",
    });
  });

  it("validates an edit the same way and saves a valid one", async () => {
    await mountPage();
    // The row actions are: Disable/Enable, Edit, Delete.
    await wrapper.findAll(".source-actions button")[1].trigger("click");
    await flushPromises();

    await dialog()
      .get('input[placeholder="https://huggingface.co"]')
      .setValue("");
    await submit("Update");
    expect(mocks.api.updateFallbackSource).not.toHaveBeenCalled();
    expect(dialog().text()).toContain("URL is required");

    await dialog()
      .get('input[placeholder="https://huggingface.co"]')
      .setValue("https://huggingface.co");
    await submit("Update");
    expect(mocks.api.updateFallbackSource).toHaveBeenCalledOnce();
  });

  it("opens the next dialog without the earlier error messages", async () => {
    await mountPage();
    await open("Add Source");
    await submit("Create");
    expect(dialog().text()).toContain("Name is required");

    wrapper.vm.$.setupState.openCreateDialog();
    await flushPromises();
    await settleMessages();
    expect(dialog().text()).not.toContain("Name is required");
  });

  it("clears earlier error messages when an edit dialog replaces a create dialog", async () => {
    await mountPage();
    await open("Add Source");
    await submit("Create");
    expect(dialog().text()).toContain("Name is required");

    wrapper.vm.$.setupState.openEditDialog(source);
    await flushPromises();
    await settleMessages();
    expect(dialog().text()).not.toContain("Name is required");
    expect(dialog().text()).not.toContain("URL is required");
  });
});
