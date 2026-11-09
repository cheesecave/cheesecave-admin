import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  store: { token: "admin-token" },
  lookupEntities: vi.fn(),
}));
vi.mock("@/stores/admin", () => ({ useAdminStore: () => mocks.store }));
vi.mock("@/utils/api", () => ({ lookupEntities: mocks.lookupEntities }));

import EntityPicker from "@/components/common/EntityPicker.vue";

// A select that hands its props and slots to the test: what matters here is what the picker asks of it.
const SelectStub = defineComponent({
  name: "ElSelect",
  props: {
    modelValue: { type: [String, Number], default: null },
    remoteMethod: { type: Function, default: null },
    loading: Boolean,
    allowCreate: Boolean,
    clearable: Boolean,
    disabled: Boolean,
    placeholder: { type: String, default: "" },
  },
  emits: ["visible-change", "change"],
  setup(props, { slots }) {
    return () =>
      h("div", { "data-select": "1", "data-loading": String(props.loading), "data-create": String(props.allowCreate) }, [
        slots.prefix ? h("span", { "data-prefix": "1" }, slots.prefix()) : null,
        ...(slots.default ? slots.default() : []),
      ]);
  },
});
const OptionStub = defineComponent({
  name: "ElOption",
  props: { value: { type: [String, Number], default: "" }, label: { type: String, default: "" } },
  setup(props, { slots }) {
    return () => h("div", { "data-option": String(props.value), "data-label": props.label }, slots.default ? slots.default() : []);
  },
});

const alice = { kind: "user", id: 12, username: "alice", email: "alice@example.org", is_org: false, is_active: true, has_avatar: false, matched: "username" };
const acme = { kind: "org", id: 18, username: "acme-labs", email: null, is_org: true, is_active: true, has_avatar: true, matched: "username" };
const repo = { kind: "repo", id: 48, full_id: "o/shared", repo_type: "dataset", namespace: "o", name: "shared", private: true, matched: "name" };
const off = { kind: "user", id: 30, username: "gone", email: null, is_org: false, is_active: false, has_avatar: false, matched: "username" };

function mountPicker(props = {}) {
  return mount(EntityPicker, { props, global: { stubs: { ElSelect: SelectStub, ElOption: OptionStub } } });
}
const select = (w) => w.getComponent(SelectStub);
const open = async (w) => {
  select(w).vm.$emit("visible-change", true);
  await flushPromises();
};
const type = async (w, text) => {
  select(w).props("remoteMethod")(text);
  await vi.advanceTimersByTimeAsync(200);
  await flushPromises();
};
const rows = (w) => w.findAll("[data-option]").map((r) => r.attributes("data-option"));

describe("EntityPicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.lookupEntities.mockResolvedValue({ results: [alice, acme] });
  });
  afterEach(() => vi.useRealTimers());

  it("lists the first rows when it opens, once, and passes what it was told about kinds, limit and repository type", async () => {
    const w = mountPicker({ kinds: ["repo"], limit: 5, repoType: "dataset", valueAs: "full_id" });
    mocks.lookupEntities.mockResolvedValue({ results: [repo] });

    await open(w);
    await open(w);

    expect(mocks.lookupEntities).toHaveBeenCalledTimes(1);
    expect(mocks.lookupEntities).toHaveBeenCalledWith("admin-token", { q: "", kinds: ["repo"], limit: 5, repoType: "dataset" });
    expect(rows(w)).toEqual(["o/shared"]);
  });

  it("waits for a pause in typing, then asks once with the last text", async () => {
    const w = mountPicker();
    select(w).props("remoteMethod")("a");
    await vi.advanceTimersByTimeAsync(100);
    select(w).props("remoteMethod")("al");
    await vi.advanceTimersByTimeAsync(100);
    expect(mocks.lookupEntities).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    await flushPromises();

    expect(mocks.lookupEntities).toHaveBeenCalledTimes(1);
    expect(mocks.lookupEntities.mock.calls[0][1].q).toBe("al");
    expect(rows(w)).toEqual(["alice", "acme-labs"]);
  });

  it("shows the answer of the last search even when an older one comes back later", async () => {
    const w = mountPicker();
    let first;
    mocks.lookupEntities.mockImplementationOnce(() => new Promise((resolve) => (first = resolve)));
    await type(w, "al");
    mocks.lookupEntities.mockResolvedValueOnce({ results: [acme] });
    await type(w, "acm");
    first({ results: [alice] });
    await flushPromises();

    expect(rows(w)).toEqual(["acme-labs"]);
    expect(select(w).props("loading")).toBe(false);
  });

  it("says it is loading while a search runs", async () => {
    const w = mountPicker();
    let done;
    mocks.lookupEntities.mockImplementationOnce(() => new Promise((resolve) => (done = resolve)));
    select(w).props("remoteMethod")("al");
    await vi.advanceTimersByTimeAsync(200);
    expect(select(w).props("loading")).toBe(true);
    done({ results: [] });
    await flushPromises();
    expect(select(w).props("loading")).toBe(false);
  });

  it("empties the list when the latest search fails, and ignores the failure of an outdated one", async () => {
    const w = mountPicker();
    await type(w, "al");
    expect(rows(w)).toHaveLength(2);

    mocks.lookupEntities.mockRejectedValueOnce(new Error("down"));
    await type(w, "alx");
    expect(rows(w)).toEqual([]);
    expect(select(w).props("loading")).toBe(false);

    await type(w, "al");
    let fail;
    mocks.lookupEntities.mockImplementationOnce(() => new Promise((_, reject) => (fail = reject)));
    await type(w, "stale");
    mocks.lookupEntities.mockResolvedValueOnce({ results: [acme] });
    await type(w, "fresh");
    fail(new Error("late"));
    await flushPromises();
    expect(rows(w)).toEqual(["acme-labs"]);
  });

  it("gives each option the value the form wants: username, id, full id, or kind-qualified repository", async () => {
    mocks.lookupEntities.mockResolvedValue({ results: [alice, repo] });
    const expected = { username: ["alice", undefined], id: [12, undefined], full_id: [undefined, "o/shared"], repo: [undefined, "dataset:o/shared"] };
    for (const [valueAs, [user, repoValue]] of Object.entries(expected)) {
      const w = mountPicker({ valueAs, kinds: ["user", "repo"] });
      await open(w);
      const values = w.findAll("[data-option]").map((r) => r.attributes("data-option"));
      if (user !== undefined) expect(values).toContain(String(user));
      if (repoValue !== undefined) expect(values).toContain(repoValue);
    }
  });

  it("shows the picture of what is selected, and nothing for a value it does not know", async () => {
    const known = mountPicker({ modelValue: "alice" });
    await open(known);
    await known.setProps({ modelValue: "alice" });
    expect(known.find("[data-prefix] .entity-avatar").exists()).toBe(true);

    const unknown = mountPicker({ modelValue: "nobody" });
    await flushPromises();
    expect(unknown.find("[data-prefix]").exists()).toBe(false);
    expect(mountPicker().find("[data-prefix]").exists()).toBe(false);
  });

  it("keeps the selected row at the top of the list when the search no longer returns it", async () => {
    const w = mountPicker({ modelValue: "alice" });
    await open(w);
    mocks.lookupEntities.mockResolvedValueOnce({ results: [acme] });
    await type(w, "acm");

    expect(rows(w)).toEqual(["alice", "acme-labs"]);
  });

  it("reports a pick, and a clear as an empty string for text values and null for an id", async () => {
    const text = mountPicker();
    await open(text);
    select(text).vm.$emit("change", "alice");
    select(text).vm.$emit("change", undefined);
    select(text).vm.$emit("change", "");
    expect(text.emitted("update:modelValue")).toEqual([["alice"], [""], [""]]);
    expect(text.emitted("change")[0][0]).toMatchObject({ username: "alice", id: 12 });
    expect(text.emitted("change")[1]).toEqual([null]);

    const id = mountPicker({ valueAs: "id", kinds: ["org"] });
    select(id).vm.$emit("change", null);
    expect(id.emitted("update:modelValue")).toEqual([[null]]);
  });

  it("hands over a typed text it has no row for as a stand-in item of the first kind", () => {
    const w = mountPicker({ allowFreeText: true, kinds: ["org", "user"] });
    select(w).vm.$emit("change", "outside-org");

    expect(w.emitted("update:modelValue")).toEqual([["outside-org"]]);
    expect(w.emitted("change")[0][0]).toEqual({ kind: "org", username: "outside-org", synthetic: true });
    expect(select(w).props("allowCreate")).toBe(true);
    expect(mountPicker().getComponent(SelectStub).props("allowCreate")).toBe(false);
  });

  it("finds who a value from outside is, so the box can show a name: id, repository, username", async () => {
    mocks.lookupEntities.mockResolvedValueOnce({ results: [acme] });
    const byId = mountPicker({ modelValue: 18, valueAs: "id", kinds: ["org"] });
    await flushPromises();
    expect(mocks.lookupEntities).toHaveBeenLastCalledWith("admin-token", { q: "#18", kinds: ["org"], limit: 8, repoType: "" });
    expect(byId.find("[data-prefix] .entity-avatar").exists()).toBe(true);

    mocks.lookupEntities.mockResolvedValueOnce({ results: [repo] });
    mountPicker({ modelValue: "dataset:o/shared", valueAs: "repo", kinds: ["repo"] });
    await flushPromises();
    expect(mocks.lookupEntities.mock.calls.at(-1)[1].q).toBe("o/shared");

    mocks.lookupEntities.mockResolvedValueOnce({ results: [alice] });
    mountPicker({ modelValue: "alice" });
    await flushPromises();
    expect(mocks.lookupEntities.mock.calls.at(-1)[1].q).toBe("alice");
  });

  it("does not look up an empty value or one it already knows, and survives a failing lookup", async () => {
    mountPicker({ modelValue: "" });
    mountPicker({ modelValue: null });
    await flushPromises();
    expect(mocks.lookupEntities).not.toHaveBeenCalled();

    const known = mountPicker({ modelValue: "alice" });
    await flushPromises();
    mocks.lookupEntities.mockClear();
    await known.setProps({ modelValue: "alice" });
    expect(mocks.lookupEntities).not.toHaveBeenCalled();

    mocks.lookupEntities.mockRejectedValueOnce(new Error("down"));
    const failing = mountPicker({ modelValue: "ghost" });
    await flushPromises();
    expect(failing.find("[data-prefix]").exists()).toBe(false);
  });

  it("keeps a free-text value as its own selection when nobody matches it", async () => {
    mocks.lookupEntities.mockResolvedValueOnce({ results: [] });
    const w = mountPicker({ modelValue: "upstream-org", allowFreeText: true, kinds: ["user", "org"] });
    await flushPromises();

    expect(rows(w)).toEqual(["upstream-org"]);
    expect(w.find("[data-prefix] .entity-avatar").text()).toBe("U");
  });

  it("sets the matching part in bold in the name and the email, and not for an empty or hash-only query", async () => {
    const w = mountPicker({ kinds: ["user", "org"] });
    await open(w);
    expect(w.findAll(".hit")).toHaveLength(0);

    mocks.lookupEntities.mockResolvedValueOnce({ results: [alice] });
    await type(w, "ali");
    expect(w.findAll(".ep-name .hit").map((n) => n.text())).toEqual(["ali"]);
    expect(w.findAll(".ep-sub .hit").map((n) => n.text())).toEqual(["ali"]);

    mocks.lookupEntities.mockResolvedValueOnce({ results: [alice] });
    await type(w, "#");
    expect(w.findAll(".hit")).toHaveLength(0);

    mocks.lookupEntities.mockResolvedValueOnce({ results: [alice] });
    await type(w, "ice");
    expect(w.findAll(".ep-name .hit").map((n) => n.text())).toEqual(["ice"]);
    expect(w.find(".ep-name .ep-text").text()).toBe("alice");

    select(w).vm.$emit("visible-change", false);
    await flushPromises();
    expect(w.findAll(".hit")).toHaveLength(0);
  });

  it("marks an id match, organizations, repositories and disabled accounts, and shows an email only when there is one", async () => {
    mocks.lookupEntities.mockResolvedValue({ results: [{ ...alice, matched: "id" }, acme, off, repo] });
    const w = mountPicker({ kinds: ["user", "org", "repo"] });
    await open(w);
    const by = (label) => w.get(`[data-label="${label}"]`);

    expect(by("alice").get(".ep-id").classes()).toContain("hit");
    expect(by("alice").get(".ep-id").text()).toBe("#12");
    expect(by("alice").find(".ep-sub").text()).toBe("alice@example.org");
    expect(by("acme-labs").get(".ep-tag.org").text()).toBe("Org");
    expect(by("acme-labs").find(".ep-sub").exists()).toBe(false);
    expect(by("acme-labs").get(".ep-id").classes()).not.toContain("hit");
    expect(by("gone").get(".ep-tag.off").text()).toBe("disabled");
    expect(by("alice").find(".ep-tag").exists()).toBe(false);
    const repoRow = by("o/shared");
    expect(repoRow.findAll(".ep-tag").map((t) => t.text())).toEqual(["dataset", "private"]);
    expect(repoRow.find(".ep-id").exists()).toBe(false);
  });

  it("does not mark a public repository private", async () => {
    mocks.lookupEntities.mockResolvedValue({ results: [{ ...repo, private: false }] });
    const w = mountPicker({ kinds: ["repo"], valueAs: "full_id" });
    await open(w);

    expect(w.findAll(".ep-tag").map((t) => t.text())).toEqual(["dataset"]);
  });

  it("stops its pending search when it goes away", async () => {
    const w = mountPicker();
    select(w).props("remoteMethod")("al");
    w.unmount();
    await vi.advanceTimersByTimeAsync(300);

    expect(mocks.lookupEntities).not.toHaveBeenCalled();
  });
});
