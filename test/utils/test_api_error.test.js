import { describe, expect, it } from "vitest";
import { getApiErrorMessage } from "@/utils/api-error";
import { getSiteApiErrorMessage } from "@/utils/siteApiError";

describe("admin error presentation priorities", () => {
  it("preserves Site detail priority when both backend fields exist", () => {
    const error = {
      message: "Axios message",
      response: {
        data: {
          detail: { error: { message: "Detail failure" } },
          error: "HF failure",
        },
      },
    };
    expect(getSiteApiErrorMessage(error, "Save failed")).toBe("Detail failure");
    expect(getApiErrorMessage(error, "Save failed")).toBe("Detail failure");
  });

  it("keeps Site request messages ahead of fallback and normal admin actions' fallback ahead of request messages", () => {
    const error = new Error("Offline");
    expect(getSiteApiErrorMessage(error, "Save failed")).toBe("Offline");
    expect(getApiErrorMessage(error, "Save failed")).toBe("Save failed");
    expect(
      getApiErrorMessage(error, "Save failed", { preferRequestMessage: true }),
    ).toBe("Offline");
  });

  it("reads nested validation entries and plain string bodies in ordinary admin actions", () => {
    expect(
      getApiErrorMessage(
        {
          response: {
            data: {
              detail: [
                { msg: "Invalid user" },
                { error: { message: "Invalid timestamp" } },
              ],
            },
          },
        },
        "Revoke failed",
      ),
    ).toBe("Invalid user; Invalid timestamp");
    expect(
      getApiErrorMessage({ response: { data: "Maintenance" } }, "Load failed"),
    ).toBe("Maintenance");
  });

  it("ignores cyclic unknown objects and uses status only without other messages", () => {
    const cycle = {};
    cycle.detail = cycle;
    expect(
      getApiErrorMessage(
        { response: { status: 503, data: { detail: cycle } } },
        "Load failed",
      ),
    ).toBe("Load failed");
    expect(
      getApiErrorMessage({
        response: { status: 503, data: { detail: cycle } },
      }),
    ).toBe("Request failed (HTTP 503).");
    expect(
      getSiteApiErrorMessage({ response: { data: { detail: cycle } } }),
    ).toBe("Request failed.");
  });
});
