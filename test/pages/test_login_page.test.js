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
  adminStore: {
    login: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
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
});
