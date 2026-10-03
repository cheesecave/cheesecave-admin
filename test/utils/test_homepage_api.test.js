import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "@/testing/axios";
import { getSiteHomepage, updateSiteHomepage } from "@/utils/api";
import { DEFAULT_HOMEPAGE } from "../../src/shared/site-homepage.js";

describe("admin homepage API", () => {
  const client = { get: vi.fn(), put: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(axios, "create").mockReturnValue(client);
    client.get.mockResolvedValue({ data: DEFAULT_HOMEPAGE });
    client.put.mockResolvedValue({ data: DEFAULT_HOMEPAGE });
  });

  it("uses authenticated GET and PUT, preserving the complete homepage config", async () => {
    expect(await getSiteHomepage("admin-token")).toEqual(DEFAULT_HOMEPAGE);
    expect(client.get).toHaveBeenCalledWith("/site-homepage", {
      timeout: 30000,
    });
    expect(await updateSiteHomepage("admin-token", DEFAULT_HOMEPAGE)).toEqual(
      DEFAULT_HOMEPAGE,
    );
    expect(client.put).toHaveBeenCalledWith(
      "/site-homepage",
      DEFAULT_HOMEPAGE,
      { timeout: 30000 },
    );
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: "/admin/api",
      headers: { "X-Admin-Token": "admin-token" },
    });
  });

  it("propagates auth and validation errors to the editor", async () => {
    const unauthorized = { response: { status: 401 } };
    client.get.mockRejectedValue(unauthorized);
    await expect(getSiteHomepage("expired-token")).rejects.toBe(unauthorized);
    const invalid = { response: { status: 422 } };
    client.put.mockRejectedValue(invalid);
    await expect(
      updateSiteHomepage("admin-token", DEFAULT_HOMEPAGE),
    ).rejects.toBe(invalid);
  });
});
