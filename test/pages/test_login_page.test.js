import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia } from "pinia";
import { useSiteBrandingStore } from "@/stores/siteBranding";
import { DEFAULT_BRANDING } from "../../src/shared/site-branding.js";

import { ElementPlusStubs } from "../helpers/vue";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
  route: { query: {} },
  adminStore: {
    login: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
  useRoute: () => mocks.route,
}));

vi.mock("@/stores/admin", () => ({
  useAdminStore: () => mocks.adminStore,
}));

vi.mock("element-plus", async () => {
  const actual = await vi.importActual("element-plus");
  return actual;
});

import LoginPage from "@/pages/login.vue";

describe("admin login page", () => {
  let pinia;
  const wrappers = [];
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.route.query = {};
    pinia = createPinia();
  });
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    pinia._s.forEach((store) => store.$dispose());
  });

  function mountPage() {
    const wrapper = mount(LoginPage, {
      global: {
        plugins: [pinia],
        stubs: ElementPlusStubs,
      },
    });
    wrappers.push(wrapper);
    return wrapper;
  }

  it("is the main landmark of the page", () => {
    const wrapper = mountPage();

    expect(wrapper.element.tagName).toBe("MAIN");
  });

  it("tells the operator where the admin token lives under the current variable name", () => {
    const wrapper = mountPage();

    expect(wrapper.text()).toContain("CHEESE_CAVE_ADMIN_SECRET_TOKEN");
    expect(wrapper.text()).not.toContain("KOHAKU_HUB_");
  });

  it("follows site branding updates and recovers from a failed logo with the packaged default", async () => {
    const store = useSiteBrandingStore(pinia);
    const logo = (fill) =>
      `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${fill}"/></svg>`)}`;
    const firstLogo = logo("red");
    store.apply({
      ...DEFAULT_BRANDING,
      site_name: "DeepGHS Hub",
      header_logo: firstLogo,
    });
    const wrapper = mountPage();
    expect(wrapper.get("h1").text()).toBe("DeepGHS Hub Admin");
    expect(wrapper.get("img").attributes("src")).toBe(firstLogo);
    expect(wrapper.get("img").attributes("alt")).toBe("DeepGHS Hub logo");
    await wrapper.get("img").trigger("error");
    expect(wrapper.get("img").attributes("src")).toBe(
      "/admin/images/logo-square.svg",
    );

    const nextLogo = logo("blue");
    store.apply({
      ...DEFAULT_BRANDING,
      site_name: "Updated Hub",
      header_logo: nextLogo,
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.get("img").attributes("src")).toBe(nextLogo);
    expect(wrapper.get("h1").text()).toBe("Updated Hub Admin");
    store.apply(DEFAULT_BRANDING);
    await wrapper.vm.$nextTick();
    expect(wrapper.get("img").attributes("src")).toBe(
      "/admin/images/logo-square.svg",
    );
  });

  it("draws the lock icon in the token field as an icon class, not an unknown <lock> element", () => {
    const wrapper = mountPage();

    expect(wrapper.find('[data-slot="prefix"] .i-carbon-locked').exists()).toBe(
      true,
    );
    expect(wrapper.find("lock").exists()).toBe(false);
  });

  it("names the page for the browser tab", () => {
    mountPage();

    expect(useSiteBrandingStore(pinia).pageTitle).toBe("Sign in");
  });

  it("rejects empty login attempts before calling the store", async () => {
    const wrapper = mountPage();

    await wrapper.get("form").trigger("submit");

    expect(mocks.adminStore.login).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("logs in successfully and redirects to the dashboard", async () => {
    mocks.adminStore.login.mockResolvedValue(true);
    const wrapper = mountPage();

    await wrapper.get('input[placeholder="Admin Token"]').setValue("token-123");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(mocks.adminStore.login).toHaveBeenCalledWith("token-123");
    expect(mocks.router.push).toHaveBeenCalledWith("/");
  });

  it("returns to the page the admin asked for after logging in", async () => {
    mocks.adminStore.login.mockResolvedValue(true);
    mocks.route.query = { redirect: "/users?page=2" };
    const wrapper = mountPage();

    await wrapper.get('input[placeholder="Admin Token"]').setValue("token-123");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(mocks.router.push).toHaveBeenCalledWith("/users?page=2");
  });

  it("ignores a redirect that leaves the admin portal", async () => {
    mocks.adminStore.login.mockResolvedValue(true);
    mocks.route.query = { redirect: "https://evil.example/" };
    const wrapper = mountPage();

    await wrapper.get('input[placeholder="Admin Token"]').setValue("token-123");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(mocks.router.push).toHaveBeenCalledWith("/");
  });

  it("clears the token field when verification fails or the API errors", async () => {
    mocks.adminStore.login.mockResolvedValueOnce(false);
    const wrapper = mountPage();

    const input = wrapper.get('input[placeholder="Admin Token"]');
    await input.setValue("bad-token");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(input.element.value).toBe("");
    expect(mocks.router.push).not.toHaveBeenCalled();

    mocks.adminStore.login.mockRejectedValueOnce({
      response: {
        data: {
          detail: {
            error: "Backend rejected token",
          },
        },
      },
    });

    await input.setValue("exploded-token");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(input.element.value).toBe("");
    expect(mocks.router.push).not.toHaveBeenCalledWith("/");
  });

  describe("when the backend asks the client to wait (429)", () => {
    const tooMany = (seconds, { header = true, detail = true } = {}) => ({
      response: {
        status: 429,
        headers: header ? { "retry-after": String(seconds) } : {},
        data: detail
          ? {
              detail: {
                error: "Too many failed attempts",
                retry_after: seconds,
              },
            }
          : {},
      },
    });

    async function submitWith(wrapper, error) {
      mocks.adminStore.login.mockRejectedValueOnce(error);
      await wrapper.get('input[placeholder="Admin Token"]').setValue("a-token");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
    }

    const notice = (wrapper) => wrapper.find('[data-testid="login-wait"]');
    const loginButton = (wrapper) => wrapper.get('button[type="submit"]');

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("shows a countdown, disables the button and enables it again when the wait is over", async () => {
      const wrapper = mountPage();
      await submitWith(wrapper, tooMany(3));

      expect(notice(wrapper).text()).toContain("Too many failed attempts");
      expect(notice(wrapper).text()).toContain("3 s");
      expect(notice(wrapper).attributes("role")).toBe("alert");
      expect(loginButton(wrapper).attributes("disabled")).toBeDefined();

      await vi.advanceTimersByTimeAsync(1000);
      expect(notice(wrapper).text()).toContain("2 s");
      await vi.advanceTimersByTimeAsync(2000);

      expect(notice(wrapper).exists()).toBe(false);
      expect(loginButton(wrapper).attributes("disabled")).toBeUndefined();
    });

    it("counts long waits in minutes and seconds", async () => {
      const wrapper = mountPage();
      await submitWith(wrapper, tooMany(125));

      expect(notice(wrapper).text()).toContain("2:05");
    });

    it("takes the wait from the body when the header is missing, and falls back to a second", async () => {
      const wrapper = mountPage();
      await submitWith(wrapper, tooMany(7, { header: false }));
      expect(notice(wrapper).text()).toContain("7 s");
      wrapper.unmount();

      const other = mountPage();
      await submitWith(other, tooMany(0, { header: false, detail: false }));
      expect(notice(other).text()).toContain("1 s");
    });

    it("does not submit while waiting, and a later wrong token restarts the countdown", async () => {
      const wrapper = mountPage();
      await submitWith(wrapper, tooMany(2));
      mocks.adminStore.login.mockClear();

      await wrapper.get("form").trigger("submit"); // the form can still be submitted by Enter
      await flushPromises();
      expect(mocks.adminStore.login).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2000);
      await submitWith(wrapper, tooMany(4));
      expect(notice(wrapper).text()).toContain("4 s");
    });

    it("stops counting when the page goes away", async () => {
      const wrapper = mountPage();
      await submitWith(wrapper, tooMany(5));
      const pending = vi.getTimerCount();
      wrapper.unmount();

      expect(vi.getTimerCount()).toBeLessThan(pending);
    });

    it("keeps the usual message for other errors", async () => {
      const wrapper = mountPage();
      await submitWith(wrapper, {
        response: { status: 500, data: { detail: { error: "boom" } } },
      });

      expect(notice(wrapper).exists()).toBe(false);
      expect(loginButton(wrapper).attributes("disabled")).toBeUndefined();
    });
  });
});
