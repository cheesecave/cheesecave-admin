import { describe, expect, it } from "vitest";
import { getSiteApiErrorMessage } from "@/utils/siteApiError";

describe("Site API error messages", () => {
  it.each([
    [{ detail: { error: "Could not save" } }, "Could not save"],
    [{ detail: "Backend offline" }, "Backend offline"],
    [
      {
        detail: [
          { msg: "Title is required", loc: ["body", "title"] },
          { msg: "Invalid URL" },
        ],
      },
      "Title is required; Invalid URL",
    ],
    [
      { detail: ["Invalid title", { error: "Invalid URL" }, null] },
      "Invalid title; Invalid URL",
    ],
    [{ detail: { error: { message: "Nested failure" } } }, "Nested failure"],
    [{ error: "Top-level failure" }, "Top-level failure"],
    ["Plain response error", "Plain response error"],
  ])("reads supported backend error shapes %j", (data, expected) => {
    expect(
      getSiteApiErrorMessage(
        { message: "Generic Axios error", response: { status: 422, data } },
        "Save failed",
      ),
    ).toBe(expected);
  });

  it("uses the request message then the action fallback for unrecognized details", () => {
    expect(
      getSiteApiErrorMessage(
        {
          message: "Network error",
          response: { data: { detail: { unknown: true } } },
        },
        "Save failed",
      ),
    ).toBe("Network error");
    expect(
      getSiteApiErrorMessage(
        { response: { data: { detail: [{ unknown: true }, null, " "] } } },
        "Save failed",
      ),
    ).toBe("Save failed");
    expect(getSiteApiErrorMessage(new Error("Enter a title."))).toBe(
      "Enter a title.",
    );
  });

  it.each([401, 403, 503])(
    "uses status %s only when no readable message or action fallback exists",
    (status) => {
      expect(
        getSiteApiErrorMessage(
          { response: { status } },
          "Failed to load settings",
        ),
      ).toBe("Failed to load settings");
      expect(getSiteApiErrorMessage({ response: { status } })).toBe(
        `Request failed (HTTP ${status}).`,
      );
    },
  );

  it("does not stringify missing, malformed or cyclic details", () => {
    const cyclic = {};
    cyclic.error = cyclic;
    for (const error of [
      null,
      undefined,
      {},
      { response: { status: "503", data: { detail: {} } } },
      { response: { data: { detail: cyclic } } },
    ]) {
      expect(getSiteApiErrorMessage(error)).toBe("Request failed.");
    }
  });
});
