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

const routeState = vi.hoisted(() => ({ query: { create: "1" } }));
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

import InvitationsPage from "@/pages/invitations.vue";

// The real picker is tested on its own; here it is a button that "picks" organization 18, or clears the pick.
const PickerStub = defineComponent({
  name: "EntityPicker",
  props: { modelValue: { type: [String, Number], default: null }, kinds: Array, valueAs: String, placeholder: String },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () =>
      h("div", { "data-picker": "1", "data-kinds": (props.kinds || []).join(","), "data-value-as": props.valueAs, "data-value": String(props.modelValue) }, [
        h("button", { "data-pick": "1", onClick: () => emit("update:modelValue", 18) }),
        h("button", { "data-clear": "1", onClick: () => emit("update:modelValue", null) }),
      ]);
  },
});

async function mountPage() {
  mocks.api.listInvitations.mockResolvedValue({ invitations: [] });
  const wrapper = mount(InvitationsPage, {
    global: { stubs: { ...ElementPlusStubs, EntityPicker: PickerStub }, directives: { loading: {} } },
  });
  await flushPromises();
  return wrapper;
}
// the page header has a button of the same name; the one in the dialog footer comes last
const generate = (w) => w.findAll("button").filter((b) => b.text() === "Generate Invitation").at(-1);

describe("invitation: the organization to join is picked, not typed as an id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.createRegisterInvitation.mockResolvedValue({ invitation_link: "https://hub.example/register?invitation=tok" });
  });

  it("asks for an organization and wants its id", async () => {
    const w = await mountPage();
    const picker = w.get("[data-picker]");

    expect(picker.attributes("data-kinds")).toBe("org");
    expect(picker.attributes("data-value-as")).toBe("id");
    expect(picker.attributes("data-value")).toBe("null");
    expect(w.text()).not.toContain("Role assigned when user joins organization");
  });

  it("sends the id of the picked organization, and offers the role only then", async () => {
    const w = await mountPage();
    await w.get("[data-pick]").trigger("click");

    expect(w.get("[data-picker]").attributes("data-value")).toBe("18");
    expect(w.text()).toContain("Role assigned when user joins organization");

    await generate(w).trigger("click");
    await flushPromises();
    expect(mocks.api.createRegisterInvitation).toHaveBeenCalledWith("admin-token", { org_id: 18, role: "member", max_usage: 10, expires_days: 7 });
  });

  it("sends no organization when none is picked, or the pick is cleared", async () => {
    const w = await mountPage();
    await w.get("[data-pick]").trigger("click");
    await w.get("[data-clear]").trigger("click");

    expect(w.text()).not.toContain("Role assigned when user joins organization");
    await generate(w).trigger("click");
    await flushPromises();
    expect(mocks.api.createRegisterInvitation).toHaveBeenCalledWith("admin-token", { org_id: null, role: "member", max_usage: 10, expires_days: 7 });
  });
});
