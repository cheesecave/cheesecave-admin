import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  adminStore: { token: "session", authMode: "session", logout: vi.fn() },
  api: {
    listPanelSessions: vi.fn(),
    revokePanelSession: vi.fn(),
    revokeOtherPanelSessions: vi.fn(),
  },
  dialogs: {
    confirmDialog: vi.fn(),
    showError: vi.fn(),
    showSuccess: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.adminStore }));
vi.mock("@/utils/api", () => ({
  listPanelSessions: (...args) => mocks.api.listPanelSessions(...args),
  revokePanelSession: (...args) => mocks.api.revokePanelSession(...args),
  revokeOtherPanelSessions: (...args) =>
    mocks.api.revokeOtherPanelSessions(...args),
}));
vi.mock("@/utils/dialogs", () => ({
  confirmDialog: (...args) => mocks.dialogs.confirmDialog(...args),
  showError: (...args) => mocks.dialogs.showError(...args),
  showSuccess: (...args) => mocks.dialogs.showSuccess(...args),
}));
vi.mock("@/components/AdminLayout.vue", () => ({
  default: defineComponent({
    name: "AdminLayoutStub",
    setup(_, { slots }) {
      return () => h("div", slots.default ? slots.default() : []);
    },
  }),
}));

import AdminSessionsPage from "@/pages/admin-sessions.vue";

const CHROME =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const FIREFOX =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0 Windows";
const ROWS = [
  {
    id: 2,
    created_at: "2026-10-23T09:00:00Z",
    last_used_at: "2026-10-23T09:20:00Z",
    expires_at: "2026-10-23T09:50:00Z",
    absolute_expires_at: "2026-10-23T21:00:00Z",
    ip: "203.0.113.7",
    user_agent: CHROME,
    current: true,
  },
  {
    id: 1,
    created_at: "2026-10-23T08:00:00Z",
    last_used_at: "2026-10-23T08:10:00Z",
    expires_at: "2026-10-23T08:40:00Z",
    absolute_expires_at: "2026-10-23T20:00:00Z",
    ip: "198.51.100.4",
    user_agent: FIREFOX,
    current: false,
  },
];

function mountPage() {
  return mount(AdminSessionsPage, { global: { plugins: [ElementPlus] } });
}

const buttons = (wrapper, id) => wrapper.findAll(`[data-testid="${id}"]`);

describe("admin sessions page", () => {
  beforeEach(() => {
    mocks.router.push.mockReset();
    mocks.adminStore.logout.mockReset();
    mocks.adminStore.token = "session";
    mocks.adminStore.authMode = "session";
    Object.values(mocks.api).forEach((fn) => fn.mockReset());
    Object.values(mocks.dialogs).forEach((fn) => fn.mockReset());
    mocks.api.listPanelSessions.mockResolvedValue({ sessions: ROWS });
    mocks.dialogs.confirmDialog.mockResolvedValue(undefined);
    mocks.api.revokePanelSession.mockResolvedValue({ revoked: true });
    mocks.api.revokeOtherPanelSessions.mockResolvedValue({ revoked: 1 });
  });

  it("lists the browsers signed in, says which one this is and what each is", async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(mocks.api.listPanelSessions).toHaveBeenCalledWith("session");
    const agents = wrapper
      .findAll('[data-testid="admin-sessions-agent"]')
      .map((n) => n.text());
    expect(agents).toEqual(["Chrome 141 on Linux", "Firefox 130 on Windows"]);
    expect(
      wrapper.findAll('[data-testid="admin-sessions-current"]'),
    ).toHaveLength(1);
    expect(wrapper.text()).toContain("203.0.113.7");
    expect(wrapper.text()).toContain("198.51.100.4");
    expect(wrapper.text()).not.toContain("this panel is using the admin token");
  });

  it("describes a browser it does not know by the start of its agent, and a missing one as unknown", async () => {
    mocks.api.listPanelSessions.mockResolvedValue({
      sessions: [
        { ...ROWS[1], user_agent: "curl/8.5.0", current: false },
        { ...ROWS[1], id: 5, user_agent: null, current: false },
        {
          ...ROWS[1],
          id: 6,
          user_agent: "Mozilla/5.0 Safari/605.1 Edg/130.0.1 Mac OS X",
          current: false,
        },
      ],
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(
      wrapper
        .findAll('[data-testid="admin-sessions-agent"]')
        .map((n) => n.text()),
    ).toEqual(["curl/8.5.0", "Unknown", "Edge 130 on Mac OS X"]);
  });

  it("names a browser without a system, and a session without an address, as well as it can", async () => {
    mocks.api.listPanelSessions.mockResolvedValue({
      sessions: [
        { ...ROWS[1], ip: null, user_agent: "Firefox/130.0", current: false },
      ],
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.get('[data-testid="admin-sessions-agent"]').text()).toBe(
      "Firefox 130",
    );

    await buttons(wrapper, "admin-sessions-end")[0].trigger("click");
    await flushPromises();

    expect(mocks.dialogs.confirmDialog.mock.calls[0][1]).toContain(
      "an unknown address (Firefox 130)",
    );
  });

  it("ends another session after a confirmation and loads the list again", async () => {
    const wrapper = mountPage();
    await flushPromises();

    await buttons(wrapper, "admin-sessions-end")[1].trigger("click");
    await flushPromises();

    expect(mocks.dialogs.confirmDialog).toHaveBeenCalledTimes(1);
    expect(mocks.dialogs.confirmDialog.mock.calls[0][1]).toContain(
      "198.51.100.4",
    );
    expect(mocks.api.revokePanelSession).toHaveBeenCalledWith("session", 1);
    expect(mocks.dialogs.showSuccess).toHaveBeenCalledWith("Session ended");
    expect(mocks.api.listPanelSessions).toHaveBeenCalledTimes(2);
    expect(mocks.adminStore.logout).not.toHaveBeenCalled();
  });

  it("does nothing when the confirmation is declined", async () => {
    mocks.dialogs.confirmDialog.mockRejectedValue("cancel");
    const wrapper = mountPage();
    await flushPromises();

    await buttons(wrapper, "admin-sessions-end")[1].trigger("click");
    await flushPromises();

    expect(mocks.api.revokePanelSession).not.toHaveBeenCalled();
    expect(mocks.api.revokeOtherPanelSessions).not.toHaveBeenCalled();
  });

  it("signs out of the panel when the session ended is the one in use", async () => {
    const wrapper = mountPage();
    await flushPromises();

    await buttons(wrapper, "admin-sessions-end")[0].trigger("click");
    await flushPromises();

    expect(mocks.dialogs.confirmDialog.mock.calls[0][1]).toContain("sign out");
    expect(mocks.api.revokePanelSession).toHaveBeenCalledWith("session", 2);
    expect(mocks.adminStore.logout).toHaveBeenCalled();
    expect(mocks.router.push).toHaveBeenCalledWith("/login");
  });

  it("ends every other session in one go", async () => {
    const wrapper = mountPage();
    await flushPromises();

    await buttons(wrapper, "admin-sessions-end-others")[0].trigger("click");
    await flushPromises();

    expect(mocks.dialogs.confirmDialog.mock.calls[0][1]).toContain("1 other");
    expect(mocks.api.revokeOtherPanelSessions).toHaveBeenCalledWith("session");
    expect(mocks.dialogs.showSuccess).toHaveBeenCalledWith(
      "Ended 1 session(s)",
    );
    expect(mocks.api.listPanelSessions).toHaveBeenCalledTimes(2);
  });

  it("does not offer to end the others when there are none", async () => {
    mocks.api.listPanelSessions.mockResolvedValue({ sessions: [ROWS[0]] });
    const wrapper = mountPage();
    await flushPromises();

    expect(
      buttons(wrapper, "admin-sessions-end-others")[0].attributes("disabled"),
    ).toBeDefined();
  });

  it("declines to end the others when asked not to", async () => {
    mocks.dialogs.confirmDialog.mockRejectedValue("cancel");
    const wrapper = mountPage();
    await flushPromises();

    await buttons(wrapper, "admin-sessions-end-others")[0].trigger("click");
    await flushPromises();

    expect(mocks.api.revokeOtherPanelSessions).not.toHaveBeenCalled();
  });

  it("refreshes on demand", async () => {
    const wrapper = mountPage();
    await flushPromises();

    await buttons(wrapper, "admin-sessions-refresh")[0].trigger("click");
    await flushPromises();

    expect(mocks.api.listPanelSessions).toHaveBeenCalledTimes(2);
  });

  it("says so when the panel is using the token and not a session", async () => {
    mocks.adminStore.authMode = "token";
    mocks.adminStore.token = "the-token";
    const wrapper = mountPage();
    await flushPromises();

    expect(mocks.api.listPanelSessions).toHaveBeenCalledWith("the-token");
    expect(
      wrapper.find('[data-testid="admin-sessions-token-mode"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="admin-sessions-unavailable"]').exists(),
    ).toBe(false);
  });

  it("says so when the backend has no admin sessions at all (404) and shows no table", async () => {
    mocks.adminStore.authMode = "token";
    mocks.api.listPanelSessions.mockRejectedValue({
      response: { status: 404 },
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(
      wrapper.find('[data-testid="admin-sessions-unavailable"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="admin-sessions-token-mode"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-testid="admin-sessions-table"]').exists()).toBe(
      false,
    );
    expect(mocks.dialogs.showError).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    "sends the administrator to the login page when the session is over (%i)",
    async (status) => {
      mocks.api.listPanelSessions.mockRejectedValue({ response: { status } });
      mountPage();
      await flushPromises();

      expect(mocks.dialogs.showError).toHaveBeenCalledWith(
        "Your admin session is over. Please sign in again.",
      );
      expect(mocks.adminStore.logout).toHaveBeenCalled();
      expect(mocks.router.push).toHaveBeenCalledWith("/login");
    },
  );

  it("shows other failures and keeps the page", async () => {
    mocks.api.listPanelSessions.mockRejectedValue({
      response: { status: 500, data: { detail: { error: "boom" } } },
    });
    mountPage();
    await flushPromises();

    expect(mocks.dialogs.showError).toHaveBeenCalledTimes(1);
    expect(mocks.adminStore.logout).not.toHaveBeenCalled();
  });

  it("shows a failure to end a session and keeps the list", async () => {
    mocks.api.revokePanelSession.mockRejectedValue({
      response: { status: 500, data: {} },
    });
    const wrapper = mountPage();
    await flushPromises();

    await buttons(wrapper, "admin-sessions-end")[1].trigger("click");
    await flushPromises();

    expect(mocks.dialogs.showError).toHaveBeenCalledTimes(1);
    expect(mocks.api.listPanelSessions).toHaveBeenCalledTimes(1);
  });

  it("shows a failure to end the others", async () => {
    mocks.api.revokeOtherPanelSessions.mockRejectedValue({
      response: { status: 500, data: {} },
    });
    const wrapper = mountPage();
    await flushPromises();

    await buttons(wrapper, "admin-sessions-end-others")[0].trigger("click");
    await flushPromises();

    expect(mocks.dialogs.showError).toHaveBeenCalledTimes(1);
  });

  it("shows a dash for a time the backend did not give", async () => {
    mocks.api.listPanelSessions.mockResolvedValue({
      sessions: [{ ...ROWS[1], last_used_at: null, user_agent: null }],
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get(".el-table__body").text()).toContain("—");
  });
});
