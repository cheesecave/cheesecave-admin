import { describe, expect, it } from "vitest";

import { commitsLink, parseRepoRef, repoLink, repoRef, userLink } from "@/utils/deep-links";

describe("deep links", () => {
  it("opens a user or an organization by name", () => {
    expect(userLink("mai_lin")).toEqual({ path: "/users", query: { open: "mai_lin" } });
  });

  it("opens a repository, found by its full id, and says which type it is", () => {
    expect(repoLink("dataset", "owner/shared")).toEqual({
      path: "/repositories",
      query: { q: "owner/shared", open: "dataset:owner/shared" },
    });
  });

  it("lists the commits of a repository, or all of them when the commit has no repository", () => {
    expect(commitsLink("model", "owner/demo")).toEqual({ path: "/commits", query: { repo: "model:owner/demo" } });
    expect(commitsLink("model", null)).toEqual({ path: "/commits" });
    expect(commitsLink(undefined, undefined)).toEqual({ path: "/commits" });
  });

  it("writes and reads a repository reference as type:owner/name", () => {
    expect(repoRef("space", "owner/demo")).toBe("space:owner/demo");
    expect(parseRepoRef("space:owner/demo")).toEqual({ repo_type: "space", full_id: "owner/demo", namespace: "owner", name: "demo" });
  });

  it("accepts the names the Hub accepts: letters, digits, _ - and . inside, in a model, a dataset or a space", () => {
    for (const type of ["model", "dataset", "space"]) {
      expect(parseRepoRef(`${type}:Some-Org/my_repo.v2`)).toEqual({ repo_type: type, full_id: "Some-Org/my_repo.v2", namespace: "Some-Org", name: "my_repo.v2" });
    }
    expect(parseRepoRef("model:o/_x")).toMatchObject({ name: "_x" });
  });

  it("reads nothing from a reference that is not type:owner/name", () => {
    const bad_refs = [
      undefined, null, "", 5, "owner/demo", "model:", "model:owner", "model:/demo", "model:owner/", ":owner/demo",
      // a link must not steer the admin's request somewhere else: types are model, dataset or space, names have no slash,
      // no dot-only segment, no encoded or backslash characters, and a repository name starts with a letter, digit or _
      "evil:o/n", "../x:o/n", "model:../x", "model:./x", "model:o/..", "model:o/.", "model:o/a/b", "model:o/odd:name",
      "model:o/-bad", "model:o/%2e%2e", "model:o\\p/n", "model:o?x/n", "model:o#x/n", "model:o/n?x", "model:o/n#x", "model:o%2Fp/n",
    ];
    for (const bad of bad_refs) {
      expect(parseRepoRef(bad)).toBeNull();
    }
  });
});
