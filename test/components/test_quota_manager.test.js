import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ElementPlusStubs } from "../helpers/vue";

const api = vi.hoisted(() => ({
  getQuota: vi.fn(),
  setQuota: vi.fn(),
  recalculateQuota: vi.fn(),
}));
const messages = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/utils/api", () => ({
  ...api,
  formatBytes: (bytes) => `${bytes} B`,
  parseSize: (value) => Number(value),
}));

import QuotaManager from "@/components/QuotaManager.vue";

describe("QuotaManager recount", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    Object.values(api).forEach((fn) => fn.mockReset());
    Object.values(messages).forEach((fn) => fn.mockReset());
    const elementPlus = await vi.importActual("element-plus");
    vi.spyOn(elementPlus.ElMessage, "success").mockImplementation(
      messages.success,
    );
    vi.spyOn(elementPlus.ElMessage, "error").mockImplementation(messages.error);
    api.getQuota.mockResolvedValue({
      private_quota_bytes: null,
      public_quota_bytes: 100,
      private_used_bytes: 1,
      public_used_bytes: 2,
      total_used_bytes: 3,
    });
  });

  it("schedules a recount of the namespace", async () => {
    api.recalculateQuota
      .mockResolvedValueOnce({ task_id: 3, already_pending: false })
      .mockResolvedValueOnce({ task_id: null, already_pending: true });
    const wrapper = mount(QuotaManager, {
      props: { namespace: "aurora-labs", isOrg: true, token: "admin-token" },
      global: { stubs: ElementPlusStubs },
    });
    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();
    const button = () =>
      wrapper.findAll("button").find((b) => b.text() === "Recount");

    await button().trigger("click");
    await flushPromises();
    expect(api.recalculateQuota).toHaveBeenCalledWith(
      "admin-token",
      "aurora-labs",
      true,
    );
    expect(messages.success).toHaveBeenLastCalledWith(
      "Recount scheduled; usage updates when it finishes",
    );

    await button().trigger("click");
    await flushPromises();
    expect(messages.success).toHaveBeenLastCalledWith(
      "A recount of this namespace is already scheduled",
    );
    vi.useRealTimers();
  });
});

describe("QuotaManager with a quota that has no limit", () => {
  const passthrough = (name) =>
    defineComponent({
      name,
      setup:
        (_, { slots }) =>
        () =>
          h("div", slots.default?.()),
    });
  const mountManager = async () => {
    const wrapper = mount(QuotaManager, {
      props: { namespace: "aurora-labs", isOrg: true, token: "admin-token" },
      global: {
        stubs: {
          ...ElementPlusStubs,
          ElDescriptions: passthrough("ElDescriptions"),
          ElDescriptionsItem: passthrough("ElDescriptionsItem"),
        },
      },
    });
    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();
    return wrapper;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(api).forEach((fn) => fn.mockReset());
    api.getQuota.mockResolvedValue({
      private_quota_bytes: null,
      public_quota_bytes: 100,
      private_used_bytes: 1,
      public_used_bytes: 2,
      private_available_bytes: null,
      total_used_bytes: 3,
    });
  });

  it("shows the symbol and its word for the quota, and a size for a limit", async () => {
    const wrapper = await mountManager();

    expect(wrapper.text()).toContain("\u221e No limit");
    expect(wrapper.text()).toContain("100 B");
  });

  it("fills the public field with the symbol too when the public quota has no limit", async () => {
    api.getQuota.mockResolvedValue({
      private_quota_bytes: 50,
      public_quota_bytes: null,
      private_used_bytes: 1,
      public_used_bytes: 2,
      total_used_bytes: 3,
    });
    const wrapper = await mountManager();

    expect(wrapper.vm.editForm.privateQuota).toBe("50 B");
    expect(wrapper.vm.editForm.publicQuota).toBe("\u221e");
  });

  it("fills the form with the symbol, and the help says what to type", async () => {
    const wrapper = await mountManager();
    expect(wrapper.vm.editForm.privateQuota).toBe("\u221e");
    expect(wrapper.vm.editForm.publicQuota).toBe("100 B");

    wrapper.vm.editing = true;
    await flushPromises();
    const text = wrapper.text().replace(/\s+/g, " ");
    expect(text).toContain('or "\u221e" ("no limit" and "unlimited" work too)');
    expect(
      wrapper.findAll("input").map((input) => input.attributes("placeholder")),
    ).toEqual(["e.g., 10GB or \u221e", "e.g., 50GB or \u221e"]);
  });
});
