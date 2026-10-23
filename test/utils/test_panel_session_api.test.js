import { beforeEach, describe, expect, it } from "vitest";

import { http, HttpResponse } from "@/testing/msw";
import { server } from "../setup/msw-server";
import {
  createPanelSession,
  deleteRepositoryAdmin,
  endPanelSession,
  getAuthMode,
  listPanelSessions,
  moveRepositoryAdmin,
  restorePanelSession,
  revokeOtherPanelSessions,
  revokePanelSession,
  setAuthMode,
  squashRepositoryAdmin,
  verifyAdminToken,
} from "@/utils/api";

const PANEL = "cheesecave-admin";

describe("how the panel talks to the admin API", () => {
  let seen;

  function record(request) {
    seen.push({
      url: new URL(request.url).pathname,
      method: request.method,
      token: request.headers.get("X-Admin-Token"),
      panel: request.headers.get("X-Requested-With"),
    });
  }

  beforeEach(() => {
    seen = [];
    setAuthMode("token");
    server.use(
      http.all("/admin/api/*", ({ request }) => {
        record(request);
        return HttpResponse.json({ ok: true, sessions: [] });
      }),
      http.all("/api/repos/*", ({ request }) => {
        record(request);
        return HttpResponse.json({ ok: true });
      }),
    );
  });

  it("sends the token in a header, as it always did, until a session is made", async () => {
    expect(getAuthMode()).toBe("token");

    await verifyAdminToken("secret-token");

    expect(seen).toEqual([
      {
        url: "/admin/api/stats",
        method: "GET",
        token: "secret-token",
        panel: null,
      },
    ]);
  });

  it("sends no token at all in session mode, only the panel's own header", async () => {
    setAuthMode("session");
    expect(getAuthMode()).toBe("session");

    await verifyAdminToken("ignored");

    expect(seen).toEqual([
      { url: "/admin/api/stats", method: "GET", token: null, panel: PANEL },
    ]);
  });

  it("refuses a mode it does not know", () => {
    expect(() => setAuthMode("cookie-jar")).toThrow(/auth mode/i);
    expect(getAuthMode()).toBe("token");
  });

  it("sends the three repository actions to /api with the token until a session is made", async () => {
    await deleteRepositoryAdmin("t", "model", "ns", "name");
    await moveRepositoryAdmin("t", "model", "ns", "name", "ns2", "name2");
    await squashRepositoryAdmin("t", "model", "ns", "name");

    expect(seen.map((r) => [r.method, r.url, r.token, r.panel])).toEqual([
      ["DELETE", "/api/repos/delete", "t", null],
      ["POST", "/api/repos/move", "t", null],
      ["POST", "/api/repos/squash", "t", null],
    ]);
  });

  it("sends them to the admin-scoped routes under /admin in session mode, where the cookie travels", async () => {
    setAuthMode("session");

    await deleteRepositoryAdmin("t", "model", "ns", "name");
    await moveRepositoryAdmin("t", "model", "ns", "name", "ns2", "name2");
    await squashRepositoryAdmin("t", "model", "ns", "name");

    expect(seen.map((r) => [r.method, r.url, r.token, r.panel])).toEqual([
      ["DELETE", "/admin/api/repos/delete", null, PANEL],
      ["POST", "/admin/api/repos/move", null, PANEL],
      ["POST", "/admin/api/repos/squash", null, PANEL],
    ]);
  });

  it("makes a session with the token, the panel's header and nothing else", async () => {
    let body;
    server.use(
      http.post("/admin/api/session", async ({ request }) => {
        record(request);
        body = await request.json();
        return HttpResponse.json(
          {
            expires_at: "2026-10-23T10:30:00Z",
            absolute_expires_at: "2026-10-23T22:00:00Z",
          },
          { status: 201 },
        );
      }),
    );

    const ends = await createPanelSession("secret-token");

    expect(body).toEqual({ token: "secret-token" });
    expect(seen).toEqual([
      { url: "/admin/api/session", method: "POST", token: null, panel: PANEL },
    ]);
    expect(ends.absolute_expires_at).toBe("2026-10-23T22:00:00Z");
  });

  it("restores and ends a session without any token", async () => {
    await restorePanelSession();
    await endPanelSession();

    expect(seen.map((r) => [r.method, r.url, r.token, r.panel])).toEqual([
      ["GET", "/admin/api/session", null, PANEL],
      ["DELETE", "/admin/api/session", null, PANEL],
    ]);
  });

  it("lists and revokes the panel's own sessions under a name that is not the users' login sessions", async () => {
    setAuthMode("session");

    await listPanelSessions("ignored");
    await revokePanelSession("ignored", 7);
    await revokeOtherPanelSessions("ignored");

    expect(seen.map((r) => [r.method, r.url, r.token])).toEqual([
      ["GET", "/admin/api/admin-sessions", null],
      ["DELETE", "/admin/api/admin-sessions/7", null],
      ["POST", "/admin/api/admin-sessions/revoke-others", null],
    ]);
  });

  it("still lists them with the token when the panel runs in token mode", async () => {
    await listPanelSessions("secret-token");

    expect(seen).toEqual([
      {
        url: "/admin/api/admin-sessions",
        method: "GET",
        token: "secret-token",
        panel: null,
      },
    ]);
  });
});
