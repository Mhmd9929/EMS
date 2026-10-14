import { describe, expect, it } from "vitest";
import { EMIRATES_ID_REGEX, formatEmiratesId, maskEmiratesId, maskTail } from "@/lib/mask";

describe("masking", () => {
  it("masks an Emirates ID keeping 784 and the check digit", () => {
    expect(maskEmiratesId("784-1990-1234567-1")).toBe("784-••••-•••••••-1");
    expect(maskEmiratesId("784199012345671")).toBe("784-••••-•••••••-1");
  });

  it("masks all but the last characters, keeping separators", () => {
    expect(maskTail("N1234567", 3)).toBe("•••••567");
    expect(maskTail("201/2020/1234567", 3)).toBe("•••/••••/••••567");
    expect(maskTail(null)).toBe("");
  });

  it("validates and formats Emirates ID", () => {
    expect(EMIRATES_ID_REGEX.test("784-1990-1234567-1")).toBe(true);
    expect(EMIRATES_ID_REGEX.test("784199012345671")).toBe(true);
    expect(EMIRATES_ID_REGEX.test("785-1990-1234567-1")).toBe(false);
    expect(formatEmiratesId("784199012345671")).toBe("784-1990-1234567-1");
  });
});
