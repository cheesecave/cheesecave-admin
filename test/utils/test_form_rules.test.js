import { describe, expect, it } from "vitest";
import { emailRule, httpUrlRule, requiredRule } from "@/utils/form-rules";

function check(rule, value) {
  let outcome;
  rule.validator({}, value, (error) => (outcome = error));
  return outcome;
}

describe("form rules", () => {
  it("requires a value that is not blank", () => {
    const rule = requiredRule("Username");
    expect(rule.required).toBe(true);
    expect(rule.trigger).toBe("blur");
    expect(rule.message).toBe("Username is required");
    expect(rule.whitespace).toBe(true);
  });

  it("accepts plausible e-mail addresses and rejects the rest", () => {
    expect(check(emailRule, "a@b.dev")).toBeUndefined();
    expect(check(emailRule, "")).toBeUndefined(); // emptiness is the required rule's business
    expect(check(emailRule, "no-at-sign").message).toBe(
      "Enter a valid e-mail address",
    );
    expect(check(emailRule, "a@b").message).toBe(
      "Enter a valid e-mail address",
    );
    expect(check(emailRule, "a b@c.dev").message).toBe(
      "Enter a valid e-mail address",
    );
  });

  it("accepts http and https URLs only", () => {
    expect(check(httpUrlRule, "https://huggingface.co")).toBeUndefined();
    expect(check(httpUrlRule, "http://hub.local:8080/x")).toBeUndefined();
    expect(check(httpUrlRule, "")).toBeUndefined();
    for (const bad of [
      "huggingface.co",
      "ftp://x.dev",
      "https://",
      "http://a b",
    ]) {
      expect(check(httpUrlRule, bad).message).toBe(
        "Enter an http:// or https:// URL",
      );
    }
  });
});
