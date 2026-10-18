import { describe, expect, it } from "vitest";
import { loginLocation, safeRedirect } from "@/utils/login-redirect";

describe("login redirect", () => {
  it("sends an anonymous visitor to the login page and remembers where they were going", () => {
    expect(loginLocation("/users?page=2#top")).toEqual({
      path: "/login",
      query: { redirect: "/users?page=2#top" },
    });
  });

  it("keeps the login address clean when there is nothing worth coming back to", () => {
    expect(loginLocation("/")).toEqual({ path: "/login" });
    expect(loginLocation("/login")).toEqual({ path: "/login" });
    expect(loginLocation("/login?redirect=%2Fusers")).toEqual({
      path: "/login",
    });
  });

  it("only follows an in-app path after login", () => {
    expect(safeRedirect("/users?page=2")).toBe("/users?page=2");
    expect(safeRedirect("/")).toBe("/");
  });

  it.each([
    undefined,
    "",
    ["/users"],
    "users",
    "//evil.example/x",
    "/\\evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "/login",
    "/login?redirect=%2Fusers",
  ])("falls back to the dashboard for %j", (value) => {
    expect(safeRedirect(value)).toBe("/");
  });
});
