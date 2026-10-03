import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElementPlusStubs } from "../helpers/vue";
import { DEFAULT_HOMEPAGE } from "../../src/shared/site-homepage.js";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  adminStore: { token: "admin-token", logout: vi.fn() },
  getSiteHomepage: vi.fn(),
  updateSiteHomepage: vi.fn(),
}));
vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.adminStore }));
vi.mock("@/utils/api", () => ({
  getSiteHomepage: (...args) => mocks.getSiteHomepage(...args),
  updateSiteHomepage: (...args) => mocks.updateSiteHomepage(...args),
}));
vi.mock("@/components/AdminLayout.vue", () => ({
  default: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h("main", slots.default?.()),
  }),
}));

import HomepagePage from "@/components/site/HomepageSettings.vue";

const original = { ...DEFAULT_HOMEPAGE, title: "A home for your models" };
const HeroStub = defineComponent({
  props: { config: Object, preview: Boolean },
  setup: (props) => () => h("div", { "data-hero": true }, props.config.title),
});

describe("homepage administration", () => {
  let wrapper;
  let success;
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.adminStore.token = "admin-token";
    mocks.getSiteHomepage.mockResolvedValue({ ...original });
    mocks.updateSiteHomepage.mockImplementation(async (_, config) => config);
    const { ElMessage } = await vi.importActual("element-plus");
    success = vi.spyOn(ElMessage, "success").mockImplementation(() => {});
    vi.spyOn(ElMessage, "error").mockImplementation(() => {});
  });
  afterEach(() => wrapper?.unmount());

  function mountPage() {
    wrapper = mount(HomepagePage, {
      global: { stubs: { ...ElementPlusStubs, HomepageHero: HeroStub } },
    });
  }
  function button(label) {
    return wrapper.findAll("button").find((item) => item.text() === label);
  }

  it("loads authenticated settings, previews edits and saves all controls together", async () => {
    mountPage();
    await flushPromises();
    expect(mocks.getSiteHomepage).toHaveBeenCalledWith("admin-token");
    expect(wrapper.get("#homepage-title").element.value).toBe(original.title);
    expect(button("Save").element.disabled).toBe(true);
    await wrapper.get("#homepage-title").setValue(" Build with us ");
    await wrapper.get("#homepage-eyebrow").setValue("YOUR AI COMMUNITY");
    await wrapper
      .get("#homepage-description")
      .setValue("Share your next idea.");
    await wrapper.get("#homepage-primary-label").setValue("Start building");
    await wrapper.get("#homepage-primary-url").setValue("/register");
    await wrapper.get("#homepage-secondary-label").setValue("");
    await wrapper.get("#homepage-secondary-url").setValue("");
    await wrapper.get("#homepage-animation").setValue(false);
    await wrapper.get("#homepage-discovery").setValue(false);
    expect(wrapper.get("[data-hero]").text()).toBe("Build with us");
    expect(wrapper.findComponent(HeroStub).props("preview")).toBe(true);
    expect(button("Save").element.disabled).toBe(false);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.updateSiteHomepage).toHaveBeenCalledExactlyOnceWith(
      "admin-token",
      {
        ...original,
        title: "Build with us",
        eyebrow: "YOUR AI COMMUNITY",
        description: "Share your next idea.",
        primary_label: "Start building",
        primary_url: "/register",
        secondary_label: "",
        secondary_url: "",
        animation_enabled: false,
        show_repositories: false,
      },
    );
    expect(wrapper.get("#homepage-title").element.value).toBe("Build with us");
    expect(button("Save").element.disabled).toBe(true);
    expect(success).toHaveBeenCalledOnce();
  });

  it("places action buttons above settings and keeps the live preview at the bottom", async () => {
    mountPage();
    await flushPromises();
    const actions = wrapper.get('[data-testid="homepage-actions"]');
    expect(actions.element.closest(".site-settings-header")).not.toBeNull();
    expect(button("Save").element.form).toBe(wrapper.get("form").element);
    const settings = wrapper.get('[data-testid="homepage-settings"]');
    const preview = wrapper.get('[data-testid="homepage-preview"]');
    expect(
      actions.element.compareDocumentPosition(settings.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      settings.element.compareDocumentPosition(preview.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(actions.findAll("button").map((item) => item.text())).toContain(
      "Save",
    );
    expect(actions.findAll("button").map((item) => item.text())).toContain(
      "Restore",
    );
    expect(settings.find("#homepage-title").exists()).toBe(true);
    expect(preview.find("[data-hero]").exists()).toBe(true);
  });

  it.each([
    ["First line\nSecond line", "First line\nSecond line"],
    ["First line\r\nSecond line", "First line\nSecond line"],
    ["First line\\nSecond line", "First line\\nSecond line"],
    ["First line\\r\\nSecond line", "First line\\r\\nSecond line"],
  ])("edits and saves multiline title %j", async (input, savedTitle) => {
    mountPage();
    await flushPromises();
    const title = wrapper.get("#homepage-title");
    expect(title.element.tagName).toBe("TEXTAREA");
    await title.setValue(input);
    expect(wrapper.findComponent(HeroStub).props("config").title).toBe(
      savedTitle,
    );
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.updateSiteHomepage).toHaveBeenCalledWith("admin-token", {
      ...original,
      title: savedTitle,
    });
    expect(title.element.value).toBe(savedTitle);
  });

  it("restores bundled defaults only into the draft until explicitly saved", async () => {
    mountPage();
    await flushPromises();
    await wrapper.get("#homepage-enabled").setValue(false);
    expect(wrapper.find("[data-hero]").exists()).toBe(false);
    await wrapper.get("#homepage-illustration").setValue("none");
    await button("Restore").trigger("click");
    expect(mocks.updateSiteHomepage).not.toHaveBeenCalled();
    expect(wrapper.get("#homepage-title").element.value).toBe(
      DEFAULT_HOMEPAGE.title,
    );
    expect(wrapper.get("#homepage-enabled").element.checked).toBe(true);
    expect(wrapper.get("#homepage-illustration").element.value).toBe(
      "mouse-cheese",
    );
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.updateSiteHomepage).toHaveBeenCalledWith(
      "admin-token",
      DEFAULT_HOMEPAGE,
    );
  });

  it("disables mutations during loading and after a read failure, allowing retry", async () => {
    let rejectRead;
    mocks.getSiteHomepage.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRead = reject;
        }),
    );
    mountPage();
    expect(wrapper.get("fieldset").element.disabled).toBe(true);
    await wrapper.get("form").trigger("submit");
    expect(mocks.updateSiteHomepage).not.toHaveBeenCalled();
    rejectRead(new Error("Backend offline"));
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Backend offline");
    expect(wrapper.get("fieldset").element.disabled).toBe(true);
    await button("Reload").trigger("click");
    await flushPromises();
    expect(wrapper.get("fieldset").element.disabled).toBe(false);
  });

  it("preserves the draft and blocks concurrent saves on a failed save", async () => {
    mountPage();
    await flushPromises();
    await wrapper.get("#homepage-title").setValue("Unsaved title");
    let rejectSave;
    mocks.updateSiteHomepage.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject;
        }),
    );
    await wrapper.get("form").trigger("submit");
    expect(wrapper.get("fieldset").element.disabled).toBe(true);
    await wrapper.get("form").trigger("submit");
    expect(mocks.updateSiteHomepage).toHaveBeenCalledOnce();
    rejectSave({
      response: {
        status: 422,
        data: { detail: [{ msg: "Invalid homepage title" }] },
      },
    });
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Invalid homepage title");
    expect(wrapper.get("#homepage-title").element.value).toBe("Unsaved title");
    expect(wrapper.get("fieldset").element.disabled).toBe(false);
    expect(success).not.toHaveBeenCalled();
  });

  it.each([
    "javascript:alert(1)",
    "//example.com",
    "/\\example.com",
    "https://exa mple.com",
  ])("rejects unsafe button URL %s before saving", async (url) => {
    mountPage();
    await flushPromises();
    await wrapper.get("#homepage-primary-url").setValue(url);
    await wrapper.get("form").trigger("submit");
    expect(mocks.updateSiteHomepage).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain("Button links");
  });

  it.each(["", " ", "a".repeat(201)])(
    "rejects an invalid title before saving",
    async (title) => {
      mountPage();
      await flushPromises();
      await wrapper.get("#homepage-title").setValue(title);
      await wrapper.get("form").trigger("submit");
      expect(mocks.updateSiteHomepage).not.toHaveBeenCalled();
      expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    },
  );

  it.each([401, 403])(
    "logs out when loading fails with status %s",
    async (status) => {
      mocks.getSiteHomepage.mockRejectedValue({ response: { status } });
      mountPage();
      await flushPromises();
      expect(mocks.adminStore.logout).toHaveBeenCalledOnce();
      expect(mocks.router.push).toHaveBeenCalledWith("/login");
      expect(wrapper.get("fieldset").element.disabled).toBe(true);
    },
  );

  it("disables editing and redirects when the admin token expires during save", async () => {
    mountPage();
    await flushPromises();
    await wrapper.get("#homepage-title").setValue("Updated title");
    mocks.updateSiteHomepage.mockRejectedValue({ response: { status: 401 } });
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.adminStore.logout).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith("/login");
    expect(wrapper.get("fieldset").element.disabled).toBe(true);
    expect(success).not.toHaveBeenCalled();
  });

  it("redirects without API access when there is no admin token", async () => {
    mocks.adminStore.token = "";
    mountPage();
    await flushPromises();
    expect(mocks.router.push).toHaveBeenCalledWith("/login");
    expect(mocks.getSiteHomepage).not.toHaveBeenCalled();
  });
});
