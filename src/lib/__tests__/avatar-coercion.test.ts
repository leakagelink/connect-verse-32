import { describe, it, expect } from "vitest";
import { safeAvatarStyle, safeGender } from "@/lib/avatar-coercion";
import { pickDefaultStyle } from "@/lib/ai-avatar";

describe("safeGender", () => {
  it("accepts known buckets", () => {
    expect(safeGender("male")).toBe("male");
    expect(safeGender("female")).toBe("female");
    expect(safeGender("other")).toBe("other");
  });

  it("returns null for missing/null/undefined", () => {
    expect(safeGender(null)).toBeNull();
    expect(safeGender(undefined)).toBeNull();
    expect(safeGender("")).toBeNull();
  });

  it("returns null for malformed values", () => {
    expect(safeGender("MALE")).toBeNull();
    expect(safeGender("nonbinary")).toBeNull();
    expect(safeGender(42)).toBeNull();
    expect(safeGender({ gender: "male" })).toBeNull();
    expect(safeGender([])).toBeNull();
  });
});

describe("safeAvatarStyle", () => {
  it("passes through valid DiceBear style ids", () => {
    expect(safeAvatarStyle("lorelei", "female")).toBe("lorelei");
    expect(safeAvatarStyle("bottts", null)).toBe("bottts");
  });

  it("falls back to gender default when value is missing or null", () => {
    expect(safeAvatarStyle(null, "female")).toBe(pickDefaultStyle("female"));
    expect(safeAvatarStyle(undefined, "male")).toBe(pickDefaultStyle("male"));
    expect(safeAvatarStyle(null, "other")).toBe(pickDefaultStyle("other"));
  });

  it("falls back to generic default when both value and gender are missing", () => {
    expect(safeAvatarStyle(null, null)).toBe(pickDefaultStyle(null));
    expect(safeAvatarStyle(undefined, null)).toBe(pickDefaultStyle(null));
  });

  it("rejects malformed values and falls back safely", () => {
    expect(safeAvatarStyle("not-a-real-style", "female")).toBe(pickDefaultStyle("female"));
    expect(safeAvatarStyle("", "male")).toBe(pickDefaultStyle("male"));
    expect(safeAvatarStyle(123, "female")).toBe(pickDefaultStyle("female"));
    expect(safeAvatarStyle({ id: "lorelei" }, null)).toBe(pickDefaultStyle(null));
    expect(safeAvatarStyle([], "other")).toBe(pickDefaultStyle("other"));
  });

  it("always returns a non-empty string", () => {
    for (const input of [null, undefined, "", "bogus", 0, {}, []]) {
      const out = safeAvatarStyle(input, null);
      expect(typeof out).toBe("string");
      expect(out.length).toBeGreaterThan(0);
    }
  });
});
