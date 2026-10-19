import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ElementPlusStubs } from "../../helpers/vue";

const api = vi.hoisted(() => ({
  getPasswordResetStatus: vi.fn(),
  createPasswordResetLink: vi.fn(),
  revokePasswordResetLink: vi.fn(),
}));
const clip = vi.hoisted(() => ({ copyToClipboard: vi.fn() }));
const msg = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/utils/api", () => ({
  getPasswordResetStatus: (...a) => api.getPasswordResetStatus(...a),
  createPasswordResetLink: (...a) => api.createPasswordResetLink(...a),
  revokePasswordResetLink: (...a) => api.revokePasswordResetLink(...a),
}));
vi.mock("@/utils/clipboard", () => ({
  copyToClipboard: (...a) => clip.copyToClipboard(...a),
}));

import PasswordResetDialog from "@/components/users/PasswordResetDialog.vue";

const CHOICES = [
  { key: "15m", seconds: 900, label: "15 minutes" },
  { key: "1h", seconds: 3600, label: "1 hour" },
  { key: "7d", seconds: 604800, label: "7 days" },
];

function status(overrides = {}) {
  return {
    active: false,
    created_at: null,
    expires_at: null,
    default: "1h",
    choices: CHOICES,
    ...overrides,
  };
}

function mountDialog(props = {}) {
  return mount(PasswordResetDialog, {
    props: {
      modelValue: true,
      token: "admin-token",
      username: "alice",
      ...props,
    },
    global: { stubs: { ...ElementPlusStubs } },
  });
}

const byId = (w, id) => w.find(`[data-testid="${id}"]`);
const button = (w, text) =>
  w.findAll("button").find((b) => b.text().includes(text));

describe("PasswordResetDialog", () => {
  beforeEach(async () => {
    Object.values(api).forEach((fn) => fn.mockReset());
    clip.copyToClipboard.mockReset();
    msg.success.mockReset();
    msg.error.mockReset();
    const elementPlus = await vi.importActual("element-plus");
    vi.spyOn(elementPlus.ElMessage, "success").mockImplementation(msg.success);
    vi.spyOn(elementPlus.ElMessage, "error").mockImplementation(msg.error);
    api.getPasswordResetStatus.mockResolvedValue(status());
  });

  it("offers the tiers from the server with the default preselected", async () => {
    const w = mountDialog();
    await flushPromises();
    expect(api.getPasswordResetStatus).toHaveBeenCalledWith(
      "admin-token",
      "alice",
    );
    const options = w.findAll("option").map((o) => o.text());
    expect(options).toEqual(["15 minutes", "1 hour", "7 days"]);
    expect(w.find("select").element.value).toBe("1h");
    expect(byId(w, "reset-active").exists()).toBe(false);
  });

  it("does not load anything while closed, and loads when opened", async () => {
    const w = mountDialog({ modelValue: false });
    await flushPromises();
    expect(api.getPasswordResetStatus).not.toHaveBeenCalled();
    await w.setProps({ modelValue: true });
    await flushPromises();
    expect(api.getPasswordResetStatus).toHaveBeenCalledTimes(1);
  });

  it("creates a link with the chosen tier and shows it with its expiry", async () => {
    api.createPasswordResetLink.mockResolvedValue({
      username: "alice",
      url: "https://hub.example/reset-password#token=abc",
      ttl: "7d",
      created_at: "2026-10-19T10:00:00Z",
      expires_at: "2026-10-26T10:00:00Z",
    });
    const w = mountDialog();
    await flushPromises();
    await w.find("select").setValue("7d");
    await button(w, "Create link").trigger("click");
    await flushPromises();
    expect(api.createPasswordResetLink).toHaveBeenCalledWith(
      "admin-token",
      "alice",
      "7d",
    );
    expect(w.find('[data-testid="reset-link"] input').element.value).toBe(
      "https://hub.example/reset-password#token=abc",
    );
    expect(byId(w, "reset-expiry").text()).toContain("7 days");
    expect(byId(w, "reset-once").text()).toContain("only time");
  });

  it("copies the link and reports the outcome", async () => {
    api.createPasswordResetLink.mockResolvedValue({
      url: "https://hub.example/reset-password#token=abc",
      ttl: "1h",
      expires_at: "2026-10-19T11:00:00Z",
    });
    const w = mountDialog();
    await flushPromises();
    await button(w, "Create link").trigger("click");
    await flushPromises();

    clip.copyToClipboard.mockResolvedValue(true);
    await button(w, "Copy").trigger("click");
    await flushPromises();
    expect(clip.copyToClipboard).toHaveBeenCalledWith(
      "https://hub.example/reset-password#token=abc",
    );
    expect(msg.success).toHaveBeenCalledWith("Link copied");

    clip.copyToClipboard.mockResolvedValue(false);
    await button(w, "Copy").trigger("click");
    await flushPromises();
    expect(msg.error).toHaveBeenCalledWith(
      "Could not copy; select the link and copy it by hand",
    );
  });

  it("shows the server's message when creating fails", async () => {
    api.createPasswordResetLink.mockRejectedValue({
      response: {
        status: 400,
        data: { detail: { error: "Account is disabled" } },
      },
    });
    const w = mountDialog();
    await flushPromises();
    await button(w, "Create link").trigger("click");
    await flushPromises();
    expect(msg.error).toHaveBeenCalled();
    expect(byId(w, "reset-link").exists()).toBe(false);
  });

  it("tells the admin about an outstanding link and can withdraw it", async () => {
    api.getPasswordResetStatus.mockResolvedValue(
      status({ active: true, expires_at: "2026-10-19T11:00:00Z" }),
    );
    api.revokePasswordResetLink.mockResolvedValue({ revoked: 1 });
    const w = mountDialog();
    await flushPromises();
    expect(byId(w, "reset-active").text()).toContain("outstanding");
    await button(w, "Withdraw").trigger("click");
    await flushPromises();
    expect(api.revokePasswordResetLink).toHaveBeenCalledWith(
      "admin-token",
      "alice",
    );
    expect(msg.success).toHaveBeenCalledWith("Link withdrawn");
    expect(byId(w, "reset-active").exists()).toBe(false);
  });

  it("reports a failed withdrawal and keeps the notice", async () => {
    api.getPasswordResetStatus.mockResolvedValue(
      status({ active: true, expires_at: "2026-10-19T11:00:00Z" }),
    );
    api.revokePasswordResetLink.mockRejectedValue(new Error("boom"));
    const w = mountDialog();
    await flushPromises();
    await button(w, "Withdraw").trigger("click");
    await flushPromises();
    expect(msg.error).toHaveBeenCalled();
    expect(byId(w, "reset-active").exists()).toBe(true);
  });

  it("withdraws a link that was just created", async () => {
    api.createPasswordResetLink.mockResolvedValue({
      url: "https://hub.example/reset-password#token=abc",
      ttl: "1h",
      expires_at: "2026-10-19T11:00:00Z",
    });
    api.revokePasswordResetLink.mockResolvedValue({ revoked: 1 });
    const w = mountDialog();
    await flushPromises();
    await button(w, "Create link").trigger("click");
    await flushPromises();
    await button(w, "Withdraw").trigger("click");
    await flushPromises();
    expect(byId(w, "reset-link").exists()).toBe(false);
  });

  it("reports a failed status load", async () => {
    api.getPasswordResetStatus.mockRejectedValue(new Error("down"));
    const w = mountDialog();
    await flushPromises();
    expect(msg.error).toHaveBeenCalled();
    expect(button(w, "Create link").element.disabled).toBe(true);
  });

  it("forgets the link when it is closed and reopened", async () => {
    api.createPasswordResetLink.mockResolvedValue({
      url: "https://hub.example/reset-password#token=abc",
      ttl: "1h",
      expires_at: "2026-10-19T11:00:00Z",
    });
    const w = mountDialog();
    await flushPromises();
    await button(w, "Create link").trigger("click");
    await flushPromises();
    await w.setProps({ modelValue: false });
    await w.setProps({ modelValue: true });
    await flushPromises();
    expect(byId(w, "reset-link").exists()).toBe(false);
  });

  it("emits close from the Close button", async () => {
    const w = mountDialog();
    await flushPromises();
    await button(w, "Close").trigger("click");
    expect(w.emitted("update:modelValue")).toEqual([[false]]);
  });
});
