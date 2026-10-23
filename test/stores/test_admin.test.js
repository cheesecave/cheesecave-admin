import { beforeEach, describe, expect, it, vi } from "vitest";

import { http, HttpResponse } from "@/testing/msw";
import { server } from "../setup/msw-server";

describe("admin store", () => {
  const requests = [];

  function installHandlers({ status = 200 } = {}) {
    requests.length = 0;

    server.use(
      // an older backend: it does not know sessions, so the panel keeps the token in memory as it always did
      http.post("/admin/api/session", () =>
        HttpResponse.json({}, { status: 404 }),
      ),
      http.get("/admin/api/stats", ({ request }) => {
        requests.push(request.headers.get("X-Admin-Token"));

        if (status === 200) {
          return HttpResponse.json({ users: 1 });
        }
        if (status === 401) {
          return HttpResponse.json({ detail: "unauthorized" }, { status: 401 });
        }
        return HttpResponse.json({ detail: "network" }, { status });
      }),
    );
  }

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    installHandlers();
  });

  async function createStore() {
    const piniaModule = await import("pinia");
    piniaModule.setActivePinia(piniaModule.createPinia());
    const adminModule = await import("@/stores/admin");
    return adminModule.useAdminStore();
  }

  it("stores the token in memory only after successful verification", async () => {
    const store = await createStore();
    const result = await store.login("admin-secret");

    expect(result).toBe(true);
    expect(requests).toEqual(["admin-secret"]);
    expect(store.token).toBe("admin-secret");
    expect(store.isAuthenticated).toBe(true);
    expect(store.hasToken).toBe(true);
    expect(localStorage.length).toBe(0);
  });

  it("clears auth state when token verification fails", async () => {
    installHandlers({ status: 401 });

    const store = await createStore();
    store.token = "old-token";
    store.isAuthenticated = true;

    const result = await store.login("bad-token");

    expect(result).toBe(false);
    expect(requests).toEqual(["bad-token"]);
    expect(store.token).toBe("");
    expect(store.isAuthenticated).toBe(false);
    expect(store.hasToken).toBe(false);
  });

  it("clears auth state on errors and supports logout", async () => {
    installHandlers({ status: 500 });

    const store = await createStore();

    await expect(store.login("token")).rejects.toBeDefined();
    expect(requests).toEqual(["token"]);
    expect(store.token).toBe("");
    expect(store.isAuthenticated).toBe(false);

    store.token = "persisted";
    store.isAuthenticated = true;
    store.logout();

    expect(store.token).toBe("");
    expect(store.isAuthenticated).toBe(false);
  });
});

describe("admin store: sessions", () => {
  const calls = [];

  beforeEach(async () => {
    calls.length = 0;
    vi.resetModules();
    vi.clearAllMocks();
    const api = await import("@/utils/api");
    api.setAuthMode("token");
  });

  async function createStore() {
    const piniaModule = await import("pinia");
    piniaModule.setActivePinia(piniaModule.createPinia());
    const adminModule = await import("@/stores/admin");
    return adminModule.useAdminStore();
  }

  function backend({ session = 201, restore = 200, stats = 200 } = {}) {
    server.use(
      http.post("/admin/api/session", async ({ request }) => {
        calls.push(["POST session", (await request.json()).token]);
        if (session === 201) {
          return HttpResponse.json(
            {
              expires_at: "2026-10-23T10:30:00Z",
              absolute_expires_at: "2026-10-23T22:00:00Z",
            },
            { status: 201 },
          );
        }
        return HttpResponse.json(
          { detail: { error: "x", retry_after: 3 } },
          {
            status: session,
            headers: session === 429 ? { "Retry-After": "3" } : {},
          },
        );
      }),
      http.get("/admin/api/session", () => {
        calls.push(["GET session"]);
        return restore === 200
          ? HttpResponse.json({
              expires_at: "2026-10-23T10:30:00Z",
              absolute_expires_at: "2026-10-23T22:00:00Z",
            })
          : HttpResponse.json({ detail: { error: "no" } }, { status: restore });
      }),
      http.delete("/admin/api/session", () => {
        calls.push(["DELETE session"]);
        return HttpResponse.json({ revoked: true });
      }),
      http.get("/admin/api/stats", ({ request }) => {
        calls.push(["GET stats", request.headers.get("X-Admin-Token")]);
        return stats === 200
          ? HttpResponse.json({ users: 1 })
          : HttpResponse.json({ detail: "no" }, { status: stats });
      }),
    );
  }

  it("makes a session and keeps the token nowhere: only a marker that says the cookie is the credential", async () => {
    backend();
    const store = await createStore();

    const result = await store.login("admin-secret");

    expect(result).toBe(true);
    expect(calls).toEqual([["POST session", "admin-secret"]]); // no probe with the token afterwards
    expect(store.isAuthenticated).toBe(true);
    expect(store.hasToken).toBe(true);
    expect(store.authMode).toBe("session");
    expect(store.token).not.toContain("admin-secret");
    expect(JSON.stringify(store.$state)).not.toContain("admin-secret");
    expect(store.sessionEnds).toEqual({
      idle: "2026-10-23T10:30:00Z",
      absolute: "2026-10-23T22:00:00Z",
    });
    expect(localStorage.length).toBe(0);
  });

  it("says a wrong token is wrong, and a refused login does not make a session", async () => {
    backend({ session: 403 });
    const store = await createStore();

    expect(await store.login("nope")).toBe(false);
    expect(store.isAuthenticated).toBe(false);
    expect(store.authMode).toBe("token");
    expect(store.token).toBe("");
  });

  it("lets the login page show a wait: a 429 is thrown with its Retry-After", async () => {
    backend({ session: 429 });
    const store = await createStore();

    await expect(store.login("nope")).rejects.toMatchObject({
      response: { status: 429 },
    });
    expect(store.isAuthenticated).toBe(false);
  });

  it("falls back to the token in memory when the backend does not know sessions (404)", async () => {
    backend({ session: 404 });
    const store = await createStore();

    expect(await store.login("admin-secret")).toBe(true);

    expect(calls).toEqual([
      ["POST session", "admin-secret"],
      ["GET stats", "admin-secret"],
    ]);
    expect(store.authMode).toBe("token");
    expect(store.token).toBe("admin-secret");
  });

  it("falls back the same way and says a wrong token is wrong when the old backend refuses it", async () => {
    backend({ session: 404, stats: 403 });
    const store = await createStore();

    expect(await store.login("nope")).toBe(false);
    expect(store.authMode).toBe("token");
    expect(store.token).toBe("");
  });

  it("does not hide other failures: a 503 (weak token) is thrown", async () => {
    backend({ session: 503 });
    const store = await createStore();

    await expect(store.login("x")).rejects.toMatchObject({
      response: { status: 503 },
    });
    expect(store.isAuthenticated).toBe(false);
  });

  it("restores the session after a reload from the cookie alone", async () => {
    backend();
    const store = await createStore();

    expect(await store.restore()).toBe(true);

    expect(calls).toEqual([["GET session"]]);
    expect(store.isAuthenticated).toBe(true);
    expect(store.authMode).toBe("session");
    expect(store.sessionEnds.absolute).toBe("2026-10-23T22:00:00Z");
  });

  it.each([401, 404, 503])(
    "stays signed out when there is nothing to restore (%i)",
    async (status) => {
      backend({ restore: status });
      const store = await createStore();

      expect(await store.restore()).toBe(false);
      expect(store.isAuthenticated).toBe(false);
      expect(store.authMode).toBe("token");
    },
  );

  it("stays signed out and quiet when the backend cannot be reached at all", async () => {
    server.use(http.get("/admin/api/session", () => HttpResponse.error()));
    const store = await createStore();

    expect(await store.restore()).toBe(false);
    expect(store.isAuthenticated).toBe(false);
  });

  it("signs out on the server too, and forgets the mode", async () => {
    backend();
    const store = await createStore();
    await store.login("admin-secret");
    calls.length = 0;

    await store.logout();

    expect(calls).toEqual([["DELETE session"]]);
    expect(store.isAuthenticated).toBe(false);
    expect(store.authMode).toBe("token");
    expect(store.token).toBe("");
    expect(store.sessionEnds).toBeNull();
  });

  it("signs out locally even when the server cannot be told (the session was already over)", async () => {
    backend();
    const store = await createStore();
    await store.login("admin-secret");
    server.use(
      http.delete("/admin/api/session", () =>
        HttpResponse.json({}, { status: 401 }),
      ),
    );

    await store.logout();

    expect(store.isAuthenticated).toBe(false);
  });

  it("does not call the server to sign out of a token-mode login", async () => {
    backend({ session: 404 });
    const store = await createStore();
    await store.login("admin-secret");
    calls.length = 0;

    await store.logout();

    expect(calls).toEqual([]);
    expect(store.token).toBe("");
  });
});
