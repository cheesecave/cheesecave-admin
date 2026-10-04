import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "@/testing/axios";
import { getSiteAppearance, updateSiteAppearance } from "@/utils/api";
import { DEFAULT_APPEARANCE } from "../../src/shared/site-appearance.js";

describe("admin site appearance API", () => {
  const client = { get: vi.fn(), put: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(axios, "create").mockReturnValue(client);
    client.get.mockResolvedValue({ data: DEFAULT_APPEARANCE });
    client.put.mockResolvedValue({ data: DEFAULT_APPEARANCE });
  });
  it("reads appearance and sends only the supplied authenticated section patch", async () => {
    expect(await getSiteAppearance("admin-token")).toEqual(DEFAULT_APPEARANCE);
    expect(client.get).toHaveBeenCalledWith("/site-appearance", {
      timeout: 30000,
    });
    const patch = { theme: { primary_light: "#123456" } };
    expect(await updateSiteAppearance("admin-token", patch)).toEqual(
      DEFAULT_APPEARANCE,
    );
    expect(client.put).toHaveBeenCalledWith("/site-appearance", patch, {
      timeout: 30000,
    });
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: "/admin/api",
      headers: { "X-Admin-Token": "admin-token" },
    });
  });
});
