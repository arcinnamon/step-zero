import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/redirect";
import { requireEnv } from "@/lib/env";

describe("safeRedirectPath", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirectPath("/dashboard?tab=1")).toBe("/dashboard?tab=1");
  });

  it("rejects other origins and missing values", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "", null, undefined]) {
      expect(safeRedirectPath(bad)).toBe("/");
    }
  });
});

describe("requireEnv", () => {
  it("returns the value or names what is missing", () => {
    expect(requireEnv("X", "1")).toBe("1");
    expect(() => requireEnv("MY_VAR", undefined)).toThrow(/MY_VAR/);
  });
});
