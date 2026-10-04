import { createPinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElementPlusStubs } from "../helpers/vue";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_FOOTER,
  FOOTER_ATTRIBUTION,
  DEFAULT_THEME,
} from "../../src/shared/site-appearance.js";
import { DEFAULT_BRANDING } from "../../src/shared/site-branding.js";
import { useSiteBrandingStore } from "@/stores/siteBranding";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  adminStore: { token: "admin-token", logout: vi.fn() },
  getSiteAppearance: vi.fn(),
  updateSiteAppearance: vi.fn(),
  getSiteBranding: vi.fn(),
  updateSiteBranding: vi.fn(),
}));
vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.adminStore }));
vi.mock("@/utils/api", () => ({
  getSiteAppearance: (...args) => mocks.getSiteAppearance(...args),
  updateSiteAppearance: (...args) => mocks.updateSiteAppearance(...args),
  getSiteBranding: (...args) => mocks.getSiteBranding(...args),
  updateSiteBranding: (...args) => mocks.updateSiteBranding(...args),
}));
import FooterSettings from "@/components/site/FooterSettings.vue";
import ThemeSettings from "@/components/site/ThemeSettings.vue";

const clone = (value) => JSON.parse(JSON.stringify(value));
const originalBranding = {
  ...DEFAULT_BRANDING,
  site_name: "DeepGHS Hub",
  footer_description: "Our community",
};
describe("footer and theme administration", () => {
  let wrapper;
  let pinia;
  let server;
  let success;
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.adminStore.token = "admin-token";
    server = clone(DEFAULT_APPEARANCE);
    mocks.getSiteAppearance.mockImplementation(async () => clone(server));
    mocks.getSiteBranding.mockResolvedValue({ ...originalBranding });
    mocks.updateSiteAppearance.mockImplementation(async (_, patch) => {
      for (const [section, value] of Object.entries(patch))
        Object.assign(server[section], clone(value));
      return clone(server);
    });
    mocks.updateSiteBranding.mockImplementation(async (_, patch) => ({
      ...originalBranding,
      ...patch,
    }));
    const { ElMessage } = await vi.importActual("element-plus");
    success = vi.spyOn(ElMessage, "success").mockImplementation(() => {});
    vi.spyOn(ElMessage, "error").mockImplementation(() => {});
    pinia = createPinia();
  });
  afterEach(() => {
    wrapper?.unmount();
    pinia._s.forEach((store) => store.$dispose());
  });
  async function mountPanel(component) {
    wrapper = mount(component, {
      global: { plugins: [pinia], stubs: ElementPlusStubs },
    });
    await flushPromises();
  }
  function button(text) {
    return wrapper.findAll("button").find((item) => item.text() === text);
  }

  it.each([
    [FooterSettings, "#footer-group-0-title", "Retain these resources"],
    [ThemeSettings, "#theme-primary-light", "#123456"],
  ])(
    "shows nested appearance errors while retaining the draft",
    async (component, selector, value) => {
      await mountPanel(component);
      await wrapper.get(selector).setValue(value);
      mocks.updateSiteAppearance.mockRejectedValue({
        response: {
          status: 422,
          data: { detail: { error: "Settings could not be saved" } },
        },
      });
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toBe(
        "Settings could not be saved",
      );
      expect(wrapper.get(selector).element.value).toBe(value);
      expect(button("Save").element.disabled).toBe(false);
      expect(mocks.adminStore.logout).not.toHaveBeenCalled();
      expect(success).not.toHaveBeenCalled();
    },
  );

  it("saves changed footer fields and description without overwriting site identity or theme", async () => {
    await mountPanel(FooterSettings);
    expect(mocks.getSiteAppearance).toHaveBeenCalledWith("admin-token");
    expect(wrapper.get("#footer-description").element.value).toBe(
      "Our community",
    );
    await wrapper.get("#footer-group-0-title").setValue("Resources");
    await wrapper.get("#footer-description").setValue("A new description");
    await wrapper.get("#footer-build-info").setValue(false);
    await wrapper.get("#footer-settings-form").trigger("submit");
    await flushPromises();
    const groups = clone(DEFAULT_FOOTER.groups);
    groups[0].title = "Resources";
    expect(mocks.updateSiteAppearance).toHaveBeenCalledExactlyOnceWith(
      "admin-token",
      { footer: { groups, show_build_info: false } },
    );
    expect(mocks.updateSiteBranding).toHaveBeenCalledExactlyOnceWith(
      "admin-token",
      { footer_description: "A new description" },
    );
    expect(useSiteBrandingStore(pinia).branding.site_name).toBe(
      originalBranding.site_name,
    );
    expect(server.theme).toEqual(DEFAULT_THEME);
    expect(wrapper.get('[data-testid="footer-preview"]').text()).toContain(
      "A new description",
    );
    expect(success).toHaveBeenCalledOnce();
    expect(button("Save").element.disabled).toBe(true);
  });

  it("saves a description-only draft through branding without sending appearance fields", async () => {
    await mountPanel(FooterSettings);
    await wrapper.get("#footer-description").setValue("");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.updateSiteAppearance).not.toHaveBeenCalled();
    expect(mocks.updateSiteBranding).toHaveBeenCalledWith("admin-token", {
      footer_description: "",
    });
  });

  it("restores footer defaults into the draft and saves only when requested", async () => {
    server.footer.groups[0].title = "Custom resources";
    server.footer.show_build_info = false;
    await mountPanel(FooterSettings);
    await button("Restore").trigger("click");
    expect(wrapper.get("#footer-group-0-title").element.value).toBe(
      DEFAULT_FOOTER.groups[0].title,
    );
    expect(wrapper.get("#footer-description").element.value).toBe(
      DEFAULT_BRANDING.footer_description,
    );
    expect(mocks.updateSiteAppearance).not.toHaveBeenCalled();
    expect(mocks.updateSiteBranding).not.toHaveBeenCalled();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.updateSiteAppearance).toHaveBeenCalledWith("admin-token", {
      footer: { groups: DEFAULT_FOOTER.groups, show_build_info: true },
    });
  });

  it("keeps attribution and copyright fixed and excludes protected metadata from saves", async () => {
    Object.assign(server.footer, {
      project_label: "Custom project",
      project_url: "https://example.com/project",
      upstream_label: "Custom upstream",
      upstream_url: "https://example.com/upstream",
      copyright_text: "Custom copyright",
      license_label: "Custom license",
      license_url: "https://example.com/license",
    });
    await mountPanel(FooterSettings);
    for (const key of Object.keys(FOOTER_ATTRIBUTION)) {
      const id =
        key === "copyright_text"
          ? "footer-copyright"
          : `footer-${key.replaceAll("_", "-")}`;
      expect(wrapper.find(`#${id}`).exists()).toBe(false);
    }
    expect(wrapper.text()).not.toContain("Attribution and copyright");
    const preview = wrapper.get('[data-testid="footer-preview"]');
    expect(preview.text()).toContain(FOOTER_ATTRIBUTION.project_label);
    expect(preview.text()).toContain(FOOTER_ATTRIBUTION.upstream_label);
    expect(preview.text()).toContain(FOOTER_ATTRIBUTION.copyright_text);
    expect(preview.text()).toContain(FOOTER_ATTRIBUTION.license_label);
    expect(preview.text()).not.toContain("Custom project");
    expect(preview.text()).not.toContain("Custom copyright");
    await wrapper.get("#footer-build-info").setValue(false);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.updateSiteAppearance).toHaveBeenCalledExactlyOnceWith(
      "admin-token",
      {
        footer: { show_build_info: false },
      },
    );
    expect(preview.text()).toContain(FOOTER_ATTRIBUTION.copyright_text);
    expect(preview.text()).toContain(FOOTER_ATTRIBUTION.license_label);
    expect(preview.text()).not.toContain("Build information");
  });

  it("enforces group/link bounds and rejects unsafe links before saving", async () => {
    await mountPanel(FooterSettings);
    expect(button("Add group").element.disabled).toBe(true);
    await wrapper.get('[aria-label="Remove group 3"]').trigger("click");
    await button("Add group").trigger("click");
    await wrapper.get("#footer-group-2-title").setValue("Community");
    for (let index = 0; index < 8; index++)
      await wrapper.get('[aria-label="Add link to group 3"]').trigger("click");
    expect(
      wrapper.get('[aria-label="Add link to group 3"]').element.disabled,
    ).toBe(true);
    await wrapper
      .get("#footer-group-0-link-0-url")
      .setValue("javascript:alert(1)");
    await wrapper.get("form").trigger("submit");
    expect(mocks.updateSiteAppearance).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain("safe URL");
  });

  it("retains a failed description draft after successfully saving footer links", async () => {
    await mountPanel(FooterSettings);
    await wrapper.get("#footer-group-0-title").setValue("Our resources");
    await wrapper.get("#footer-description").setValue("Retain this draft");
    mocks.updateSiteBranding.mockRejectedValueOnce(
      new Error("Description save failed"),
    );
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Description save failed",
    );
    expect(wrapper.get("#footer-description").element.value).toBe(
      "Retain this draft",
    );
    expect(server.footer.groups[0].title).toBe("Our resources");
    expect(success).not.toHaveBeenCalled();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.updateSiteAppearance).toHaveBeenCalledOnce();
    expect(mocks.updateSiteBranding).toHaveBeenCalledTimes(2);
    expect(success).toHaveBeenCalledOnce();
  });

  it("saves only edited theme fields and keeps preview colors local", async () => {
    const rootColor =
      document.documentElement.style.getPropertyValue("--el-color-primary");
    await mountPanel(ThemeSettings);
    await wrapper.get("#theme-default-mode").setValue("dark");
    await wrapper.get("#theme-primary-light").setValue("#AABBCC");
    expect(
      wrapper.get('[data-testid="theme-preview-light"]').attributes("style"),
    ).toContain("--preview-primary: #AABBCC");
    expect(
      document.documentElement.style.getPropertyValue("--el-color-primary"),
    ).toBe(rootColor);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.updateSiteAppearance).toHaveBeenCalledExactlyOnceWith(
      "admin-token",
      { theme: { default_mode: "dark", primary_light: "#aabbcc" } },
    );
    expect(server.footer).toEqual(DEFAULT_FOOTER);
    expect(wrapper.get("#theme-primary-light").element.value).toBe("#aabbcc");
    expect(mocks.updateSiteBranding).not.toHaveBeenCalled();
  });

  it("updates a HEX draft through its native color picker", async () => {
    await mountPanel(ThemeSettings);
    await wrapper
      .get('[aria-label="Card background (dark) color picker"]')
      .setValue("#123456");
    expect(wrapper.get("#theme-card-dark").element.value).toBe("#123456");
    expect(
      wrapper.get('[data-testid="theme-preview-dark"]').attributes("style"),
    ).toContain("--preview-card: #123456");
  });

  it("keeps text readable when primary and surface colors swap lightness", async () => {
    await mountPanel(ThemeSettings);
    await wrapper.get("#theme-primary-light").setValue("#ffffff");
    await wrapper.get("#theme-background-light").setValue("#111827");
    await wrapper.get("#theme-card-light").setValue("#111827");
    const preview = wrapper.get('[data-testid="theme-preview-light"]');
    expect(
      wrapper.get('[data-testid="theme-preview-dark"]').classes(),
    ).not.toContain("dark");
    expect(preview.attributes("style")).toContain(
      "--preview-primary-text: #2c332b",
    );
    expect(preview.attributes("style")).toContain("--preview-text: #eef0e7");
    expect(preview.attributes("style")).toContain(
      "--preview-card-text: #eef0e7",
    );
    await wrapper.get("#theme-primary-light").setValue("#111827");
    expect(preview.attributes("style")).toContain(
      "--preview-primary-text: #eef0e7",
    );
  });

  it("rejects invalid HEX input and preserves failed theme saves for retry", async () => {
    await mountPanel(ThemeSettings);
    await wrapper.get("#theme-primary-light").setValue("red");
    await wrapper.get("form").trigger("submit");
    expect(mocks.updateSiteAppearance).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain("six-digit HEX");
    await wrapper.get("#theme-primary-light").setValue("#123456");
    mocks.updateSiteAppearance.mockRejectedValueOnce(new Error("Save failed"));
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get("#theme-primary-light").element.value).toBe("#123456");
    expect(wrapper.get('[role="alert"]').text()).toBe("Save failed");
    expect(success).not.toHaveBeenCalled();
  });

  it("restores theme defaults into the draft without mutating the server or root", async () => {
    server.theme.primary_light = "#123456";
    await mountPanel(ThemeSettings);
    await button("Restore").trigger("click");
    expect(wrapper.get("#theme-primary-light").element.value).toBe(
      DEFAULT_THEME.primary_light,
    );
    expect(mocks.updateSiteAppearance).not.toHaveBeenCalled();
    expect(button("Restore").attributes("data-type")).toBe("danger");
  });

  it.each([FooterSettings, ThemeSettings])(
    "blocks edits during loading and retries a failed read",
    async (component) => {
      mocks.getSiteAppearance.mockRejectedValueOnce(
        new Error("Backend offline"),
      );
      await mountPanel(component);
      expect(wrapper.get("fieldset").element.disabled).toBe(true);
      await wrapper.get("form").trigger("submit");
      expect(mocks.updateSiteAppearance).not.toHaveBeenCalled();
      await button("Reload").trigger("click");
      await flushPromises();
      expect(wrapper.get("fieldset").element.disabled).toBe(false);
    },
  );

  it.each([401, 403])(
    "expires the admin session on appearance read error %s",
    async (status) => {
      mocks.getSiteAppearance.mockRejectedValue({ response: { status } });
      await mountPanel(ThemeSettings);
      expect(mocks.adminStore.logout).toHaveBeenCalledOnce();
      expect(mocks.router.push).toHaveBeenCalledWith("/login");
      expect(wrapper.get("fieldset").element.disabled).toBe(true);
    },
  );

  it("expires the admin session during footer description save", async () => {
    await mountPanel(FooterSettings);
    await wrapper.get("#footer-description").setValue("Unsaved description");
    mocks.updateSiteBranding.mockRejectedValue({ response: { status: 401 } });
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.adminStore.logout).toHaveBeenCalledOnce();
    expect(wrapper.get("fieldset").element.disabled).toBe(true);
  });

  it("does not read settings without an admin token", async () => {
    mocks.adminStore.token = "";
    await mountPanel(ThemeSettings);
    expect(mocks.getSiteAppearance).not.toHaveBeenCalled();
    expect(mocks.router.push).toHaveBeenCalledWith("/login");
  });
});
