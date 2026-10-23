import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { ElConfigProvider } from "element-plus";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    isReady: vi.fn(() => Promise.resolve()),
    currentRoute: {
      value: {
        path: "/",
        fullPath: "/",
      },
    },
  },
  adminStore: {
    isAuthenticated: false,
    restore: vi.fn(() => Promise.resolve(false)),
  },
  themeStore: {
    init: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/stores/admin", () => ({
  useAdminStore: () => mocks.adminStore,
}));

vi.mock("@/stores/theme", () => ({
  useThemeStore: () => mocks.themeStore,
}));

import App from "@/App.vue";

describe("App shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.currentRoute.value.path = "/";
    mocks.router.currentRoute.value.fullPath = "/";
    mocks.adminStore.isAuthenticated = false;
    mocks.adminStore.restore.mockImplementation(() => Promise.resolve(false));
  });

  function mountApp() {
    return mount(App, {
      global: {
        stubs: {
          RouterView: defineComponent({
            // Render function, not a `template:` string: vitest.config.js
            // aliases `vue` to the runtime-only build, which cannot compile
            // templates at runtime, so a template stub renders nothing.
            name: "RouterView",
            setup() {
              return () => h("main", { "data-router-view": "true" });
            },
          }),
        },
      },
    });
  }

  it("initializes theme and redirects anonymous admins away from protected routes", async () => {
    const wrapper = mountApp();
    await flushPromises();

    expect(mocks.themeStore.init).toHaveBeenCalledTimes(1);
    expect(mocks.router.push).toHaveBeenCalledWith({ path: "/login" });
    expect(wrapper.find('[data-router-view="true"]').exists()).toBe(true);
  });

  it("asks the backend whether the cookie still stands for a session before it redirects anybody", async () => {
    // after a reload: the session is restored, so the administrator stays where they were
    mocks.adminStore.restore.mockImplementation(async () => {
      mocks.adminStore.isAuthenticated = true;
      return true;
    });
    mocks.router.currentRoute.value.path = "/users";
    mocks.router.currentRoute.value.fullPath = "/users";

    mountApp();
    await flushPromises();

    expect(mocks.adminStore.restore).toHaveBeenCalledTimes(1);
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("restores only once the router is ready, and redirects when there is no session to restore", async () => {
    mountApp();
    await flushPromises();

    expect(mocks.adminStore.restore).toHaveBeenCalledTimes(1);
    expect(mocks.router.push).toHaveBeenCalledWith({ path: "/login" });
  });

  it("keeps toast messages below the 60 px top bar so they do not cover its title", () => {
    const wrapper = mountApp();

    expect(
      wrapper.getComponent(ElConfigProvider).props("message").offset,
    ).toBeGreaterThanOrEqual(72);
    expect(wrapper.find('[data-router-view="true"]').exists()).toBe(true);
  });

  it("remembers the page an anonymous admin asked for", async () => {
    mocks.router.currentRoute.value.path = "/users";
    mocks.router.currentRoute.value.fullPath = "/users?page=2";
    mountApp();
    await flushPromises();

    expect(mocks.router.push).toHaveBeenCalledWith({
      path: "/login",
      query: { redirect: "/users?page=2" },
    });
  });

  it("reads the requested page only once the first navigation has finished", async () => {
    // On a cold load the router still reports "/" until its first navigation resolves.
    let finishNavigation;
    mocks.router.isReady.mockReturnValueOnce(
      new Promise((resolve) => (finishNavigation = resolve)),
    );
    mountApp();
    await flushPromises();
    expect(mocks.router.push).not.toHaveBeenCalled();

    mocks.router.currentRoute.value.path = "/users";
    mocks.router.currentRoute.value.fullPath = "/users?x=1";
    finishNavigation();
    await flushPromises();
    expect(mocks.router.push).toHaveBeenCalledWith({
      path: "/login",
      query: { redirect: "/users?x=1" },
    });
  });

  it("skips the login redirect when already authenticated or already on the login page", async () => {
    mocks.adminStore.isAuthenticated = true;
    const authenticatedWrapper = mountApp();
    await flushPromises();

    expect(mocks.router.push).not.toHaveBeenCalled();
    authenticatedWrapper.unmount();

    vi.clearAllMocks();
    mocks.adminStore.isAuthenticated = false;
    mocks.router.currentRoute.value.path = "/login";

    mountApp();
    await flushPromises();

    expect(mocks.themeStore.init).toHaveBeenCalledTimes(1);
    expect(mocks.router.push).not.toHaveBeenCalled();
  });
});
