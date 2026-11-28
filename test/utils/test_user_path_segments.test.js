// A username is one path segment. A name with a slash or dot segments must not change which account a request
// reaches: the browser resolves "a/../b" to "b", so the name has to be encoded as one segment (CC-SEC-04).
import { beforeEach, describe, expect, it } from "vitest";
import apiSource from "@/utils/api.js?raw";

import { http, HttpResponse } from "@/testing/msw";
import { server } from "../setup/msw-server";
import {
  createPasswordResetLink,
  deleteUser,
  getPasswordResetStatus,
  revokePasswordResetLink,
  setEmailVerification,
  setUserQuota,
} from "@/utils/api";

const TARGET = "victim";
// Names that the browser would otherwise resolve to another user's path
const HOSTILE = ["alice/../victim", "alice%2F..%2Fvictim", "alice\\..\\victim", "alice/./victim"];

let seen;
beforeEach(() => {
  seen = [];
  server.use(
    http.all("/admin/api/*", ({ request }) => {
      seen.push(new URL(request.url).pathname);
      return HttpResponse.json({ ok: true, revoked: true, active: false });
    }),
  );
});

// The path a request is expected to have: the name as exactly one encoded segment after /users/
const expectedPath = (name, rest = "") => `/admin/api/users/${encodeURIComponent(name)}${rest}`;

describe("a username with slashes or dot segments reaches only its own account", () => {
  it.each(HOSTILE)("deleteUser keeps %s as one segment", async (name) => {
    await deleteUser("token", name, false);
    expect(seen).toEqual([expect.stringMatching(/^\/admin\/api\/users\/[^/]+$/)]);
    expect(seen[0]).toBe(expectedPath(name));
  });

  it.each(HOSTILE)("setEmailVerification keeps %s as one segment", async (name) => {
    await setEmailVerification("token", name, true);
    expect(seen[0]).toBe(expectedPath(name, "/email-verification"));
  });

  it.each(HOSTILE)("setUserQuota keeps %s as one segment", async (name) => {
    await setUserQuota("token", name, 1, 2);
    expect(seen[0]).toBe(expectedPath(name, "/quota"));
  });

  it.each(HOSTILE)("getPasswordResetStatus keeps %s as one segment", async (name) => {
    await getPasswordResetStatus("token", name);
    expect(seen[0]).toBe(expectedPath(name, "/password-reset-link"));
  });

  it.each(HOSTILE)("createPasswordResetLink keeps %s as one segment", async (name) => {
    await createPasswordResetLink("token", name, "1h");
    expect(seen[0]).toBe(expectedPath(name, "/password-reset-link"));
  });

  it.each(HOSTILE)("revokePasswordResetLink keeps %s as one segment", async (name) => {
    await revokePasswordResetLink("token", name);
    expect(seen[0]).toBe(expectedPath(name, "/password-reset-link"));
  });

  it("never sends a request to the victim's path for a name that is not the victim", async () => {
    await deleteUser("token", "alice/../victim", false);
    expect(seen[0]).not.toBe(expectedPath(TARGET));
  });
});

describe("the API client builds every user path with pathSegment", () => {
  it("has no user path that interpolates a raw variable", () => {
    const raw = apiSource
      .split("\n")
      .filter((line) => /`[^`]*\/users\/\$\{/.test(line) && !/pathSegment\(/.test(line));
    expect(raw).toEqual([]);
  });
});
