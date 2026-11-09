import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import EntityAvatar from "@/components/common/EntityAvatar.vue";

const user = (over = {}) => ({ kind: "user", id: 1, username: "alice", has_avatar: false, is_org: false, ...over });

describe("EntityAvatar", () => {
  it("shows a user's picture round, from the user avatar route", () => {
    const w = mount(EntityAvatar, { props: { item: user({ has_avatar: true }), size: 40 } });

    expect(w.get("img").attributes("src")).toBe("/api/users/alice/avatar");
    expect(w.element.style.borderRadius).toBe("50%");
    expect(w.element.style.width).toBe("40px");
  });

  it("shows an organization's picture as a rounded square, from the organization route", () => {
    const w = mount(EntityAvatar, { props: { item: user({ username: "acme labs", is_org: true, has_avatar: true }) } });

    expect(w.get("img").attributes("src")).toBe("/api/organizations/acme%20labs/avatar");
    expect(w.element.style.borderRadius).not.toBe("50%");
    expect(w.element.style.width).toBe("28px");
  });

  it("falls back to the first letter, on a colour that depends only on the name", () => {
    const a1 = mount(EntityAvatar, { props: { item: user() } });
    const a2 = mount(EntityAvatar, { props: { item: user({ id: 2 }) } });
    const b = mount(EntityAvatar, { props: { item: user({ username: "zed" }) } });

    expect(a1.text()).toBe("A");
    expect(b.text()).toBe("Z");
    expect(a1.find("img").exists()).toBe(false);
    expect(a1.element.style.background).toBe(a2.element.style.background);
    expect(a1.element.style.background).toMatch(/^(hsl|rgb)\(/);
    expect(a1.element.style.background).not.toBe(b.element.style.background);
  });

  it("goes back to the letter when the picture fails, and tries again for another name", async () => {
    const w = mount(EntityAvatar, { props: { item: user({ has_avatar: true }) } });
    await w.get("img").trigger("error");

    expect(w.find("img").exists()).toBe(false);
    expect(w.text()).toBe("A");

    await w.setProps({ item: user({ username: "bob", has_avatar: true }) });
    expect(w.get("img").attributes("src")).toBe("/api/users/bob/avatar");
  });

  it("draws a repository as an icon of its type, and a nameless item as a question mark", () => {
    const icons = ["model", "dataset", "space", "other"].map((repo_type) =>
      mount(EntityAvatar, { props: { item: { kind: "repo", full_id: "o/n", repo_type } } }).get("span span").classes()[0],
    );

    expect(icons).toEqual(["i-carbon-cube", "i-carbon-data-table", "i-carbon-application", "i-carbon-cube"]);
    expect(mount(EntityAvatar, { props: { item: { kind: "repo", full_id: "o/n", repo_type: "model" } } }).text()).toBe("");
    expect(mount(EntityAvatar, { props: { item: { kind: "user" } } }).text()).toBe("?");
  });
});
