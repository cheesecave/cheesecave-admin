import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import SiteActions from "@/components/site/SiteActions.vue";
import { ElementPlusStubs } from "../helpers/vue";

describe("Site settings actions", () => {
  let wrapper;
  afterEach(() => wrapper?.unmount());
  function mountActions(props = {}) {
    wrapper = mount(SiteActions, {
      props,
      global: { stubs: ElementPlusStubs },
    });
  }
  function button(text) {
    return wrapper.findAll("button").find((item) => item.text() === text);
  }

  it("allows a failed initial load to be retried while editing remains disabled", async () => {
    mountActions({
      disabled: true,
      showRestore: true,
      showSave: true,
      formId: "settings-form",
    });
    expect(button("Reload").element.disabled).toBe(false);
    expect(button("Restore").element.disabled).toBe(true);
    expect(button("Save").element.disabled).toBe(true);
    await button("Reload").trigger("click");
    expect(wrapper.emitted("reload")).toHaveLength(1);
  });

  it("associates Save with its settings form and keeps Reload and Restore out of submit", async () => {
    mountActions({
      showRestore: true,
      showSave: true,
      formId: "footer-settings-form",
    });
    expect(button("Save").attributes("form")).toBe("footer-settings-form");
    expect(button("Save").attributes("type")).toBe("submit");
    expect(button("Save").attributes("data-type")).toBe("primary");
    expect(button("Restore").attributes("type")).toBe("button");
    expect(button("Restore").attributes("data-type")).toBe("danger");
    expect(button("Reload").attributes("type")).toBe("button");
    await button("Restore").trigger("click");
    expect(wrapper.emitted("restore")).toHaveLength(1);
  });

  it("blocks all actions during a request and enables Save only for dirty settings", async () => {
    mountActions({ busy: true, showRestore: true, showSave: true });
    expect(
      wrapper.findAll("button").every((item) => item.element.disabled),
    ).toBe(true);
    await wrapper.setProps({ busy: false, hasChanges: false });
    expect(button("Reload").element.disabled).toBe(false);
    expect(button("Restore").element.disabled).toBe(false);
    expect(button("Save").element.disabled).toBe(true);
    await wrapper.setProps({ hasChanges: true });
    expect(button("Save").element.disabled).toBe(false);
  });

  it("supports Branding's independent reload and name-save controls", () => {
    mountActions({
      showReload: false,
      showSave: true,
      formId: "site-name-form",
      saveLabel: "Save site name",
    });
    expect(wrapper.findAll("button")).toHaveLength(1);
    expect(button("Save").attributes("aria-label")).toBe("Save site name");
    expect(button("Save").attributes("form")).toBe("site-name-form");
  });
});
