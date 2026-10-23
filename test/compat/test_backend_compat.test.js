// The panel must work against the backend from before the session routes existed and against the one after them:
// the older one keeps the old behaviour (token in memory, a reload signs out), the newer one gets sessions.
// Each fake backend below applies the rule of the real one: what it accepts as proof of who is calling.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { http, HttpResponse } from "@/testing/msw";
import { server } from "../setup/msw-server";

const TOKEN = "the-shared-admin-token";
const PANEL = "cheesecave-admin";
const ENDS = {
  expires_at: "2026-10-23T10:30:00Z",
  absolute_expires_at: "2026-10-23T22:00:00Z",
};
const NO = () => HttpResponse.json({ detail: "forbidden" }, { status: 403 });
const NOT_FOUND = () =>
  HttpResponse.json({ detail: "Not Found" }, { status: 404 });

let seen;
function note(request) {
  seen.push({
    method: request.method,
    path: new URL(request.url).pathname,
    token: request.headers.get("X-Admin-Token"),
    panel: request.headers.get("X-Requested-With"),
  });
}

// before: has no session routes at all, only the header token opens anything
function oldBackend() {
  server.use(
    http.all("/admin/api/session", ({ request }) => {
      note(request);
      return NOT_FOUND();
    }),
    http.get("/admin/api/stats", ({ request }) => {
      note(request);
      return request.headers.get("X-Admin-Token") === TOKEN
        ? HttpResponse.json({ users: 1 })
        : NO();
    }),
    http.delete("/api/repos/delete", ({ request }) => {
      note(request);
      return request.headers.get("X-Admin-Token") === TOKEN
        ? HttpResponse.json({ ok: true })
        : NO();
    }),
  );
}

// after: a session cookie (kept in `cookie`, as a browser would) opens the /admin routes when the panel header is there
function newBackend() {
  const cookie = { live: false };
  const open = (request) =>
    request.headers.get("X-Admin-Token") === TOKEN ||
    (cookie.live && request.headers.get("X-Requested-With") === PANEL);
  server.use(
    http.post("/admin/api/session", async ({ request }) => {
      note(request);
      if ((await request.json()).token !== TOKEN) return NO();
      cookie.live = true;
      return HttpResponse.json(ENDS, { status: 201 });
    }),
    http.get("/admin/api/session", ({ request }) => {
      note(request);
      return cookie.live
        ? HttpResponse.json(ENDS)
        : HttpResponse.json({ detail: "no session" }, { status: 401 });
    }),
    http.delete("/admin/api/session", ({ request }) => {
      note(request);
      cookie.live = false;
      return HttpResponse.json({ revoked: true });
    }),
    http.get("/admin/api/stats", ({ request }) => {
      note(request);
      return open(request) ? HttpResponse.json({ users: 1 }) : NO();
    }),
    http.delete("/admin/api/repos/delete", ({ request }) => {
      note(request);
      return open(request) ? HttpResponse.json({ ok: true }) : NO();
    }),
    // the header-only path is unchanged for scripts, and the panel never uses it for a session
    http.delete("/api/repos/delete", ({ request }) => {
      note(request);
      return request.headers.get("X-Admin-Token") === TOKEN
        ? HttpResponse.json({ ok: true })
        : NO();
    }),
  );
}

// A page load: a new store and the API layer back to its start state. The "cookie" of the fake backend stays.
async function loadPage() {
  vi.resetModules();
  const pinia = await import("pinia");
  pinia.setActivePinia(pinia.createPinia());
  const api = await import("@/utils/api");
  const { useAdminStore } = await import("@/stores/admin");
  return { api, store: useAdminStore() };
}

describe("the panel against the backend from before the session routes", () => {
  beforeEach(() => {
    seen = [];
    oldBackend();
  });

  it("signs in with the token in memory and sends it in the header on every call, repository actions included", async () => {
    const { api, store } = await loadPage();

    expect(await store.login(TOKEN)).toBe(true);
    expect(store.authMode).toBe("token");
    expect(store.token).toBe(TOKEN);
    await api.verifyAdminToken(store.token);
    await api.deleteRepositoryAdmin(store.token, "model", "org", "repo");

    expect(seen.filter((c) => c.path !== "/admin/api/session")).toEqual([
      { method: "GET", path: "/admin/api/stats", token: TOKEN, panel: null },
      { method: "GET", path: "/admin/api/stats", token: TOKEN, panel: null },
      {
        method: "DELETE",
        path: "/api/repos/delete",
        token: TOKEN,
        panel: null,
      },
    ]);
  });

  it("signs out on a reload, as it always did", async () => {
    const first = await loadPage();
    await first.store.login(TOKEN);

    const reloaded = await loadPage();
    expect(await reloaded.store.restore()).toBe(false);
    expect(reloaded.store.isAuthenticated).toBe(false);
    expect(reloaded.store.token).toBe("");
  });

  it("still says a wrong token is wrong", async () => {
    const { store } = await loadPage();

    expect(await store.login("wrong")).toBe(false);
    expect(store.isAuthenticated).toBe(false);
  });

  it("logs out locally without calling a session route that is not there", async () => {
    const { store } = await loadPage();
    await store.login(TOKEN);
    seen.length = 0;

    await store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(seen).toEqual([]);
  });

  it("is not fooled by a 200 that is not a session (a proxy answering every path with a page)", async () => {
    server.use(
      http.all("/admin/api/session", () =>
        HttpResponse.text("<html>panel</html>", { status: 200 }),
      ),
    );
    const { store } = await loadPage();

    expect(await store.restore()).toBe(false);
    expect(await store.login(TOKEN)).toBe(true);
    expect(store.authMode).toBe("token");
    expect(store.token).toBe(TOKEN);
  });
});

describe("the panel against the backend with session routes", () => {
  beforeEach(() => {
    seen = [];
    newBackend();
  });

  it("signs in once, holds no token, and sends only the panel header, repository actions under /admin included", async () => {
    const { api, store } = await loadPage();

    expect(await store.login(TOKEN)).toBe(true);
    expect(store.authMode).toBe("session");
    expect(store.token).not.toBe(TOKEN);
    seen.length = 0;
    await api.verifyAdminToken(store.token);
    await api.deleteRepositoryAdmin(store.token, "model", "org", "repo");

    expect(seen).toEqual([
      { method: "GET", path: "/admin/api/stats", token: null, panel: PANEL },
      {
        method: "DELETE",
        path: "/admin/api/repos/delete",
        token: null,
        panel: PANEL,
      },
    ]);
  });

  it("keeps the session across a reload, and the calls after it work on the cookie alone", async () => {
    const first = await loadPage();
    await first.store.login(TOKEN);

    const reloaded = await loadPage();
    expect(reloaded.api.getAuthMode()).toBe("token");
    expect(await reloaded.store.restore()).toBe(true);
    expect(reloaded.store.authMode).toBe("session");
    seen.length = 0;
    expect(await reloaded.api.verifyAdminToken(reloaded.store.token)).toBe(
      true,
    );
    expect(seen[0].token).toBeNull();
  });

  it("ends the session on logout, so a reload is signed out", async () => {
    const first = await loadPage();
    await first.store.login(TOKEN);
    await first.store.logout();

    const reloaded = await loadPage();
    expect(await reloaded.store.restore()).toBe(false);
  });

  it("says a wrong token is wrong without making a session", async () => {
    const { store } = await loadPage();

    expect(await store.login("wrong")).toBe(false);
    expect(store.isAuthenticated).toBe(false);
    expect(store.authMode).toBe("token");
  });
});
