import { describe, expect, it } from "vitest";
import { formatIban, isValidIban, maskIban, normalizeIban } from "@/lib/iban";

describe("IBAN", () => {
  it("accepts a valid UAE IBAN (with spaces and lower case)", () => {
    expect(isValidIban("AE07 0331 2345 6789 0123 456")).toBe(true);
    expect(isValidIban("ae070331234567890123456")).toBe(true);
  });

  it("accepts valid IBANs from other countries", () => {
    expect(isValidIban("GB82 WEST 1234 5698 7654 32")).toBe(true);
    expect(isValidIban("SA03 8000 0000 6080 1016 7519")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidIban("AE080331234567890123456")).toBe(false);
  });

  it("rejects wrong country length", () => {
    expect(isValidIban("AE07033123456789012345")).toBe(false); // 22 chars
  });

  it("rejects garbage", () => {
    expect(isValidIban("")).toBe(false);
    expect(isValidIban("not an iban")).toBe(false);
    expect(isValidIban("1234567890")).toBe(false);
  });

  it("normalises, formats and masks", () => {
    expect(normalizeIban("ae07-0331 2345")).toBe("AE0703312345");
    expect(formatIban("AE070331234567890123456")).toBe("AE07 0331 2345 6789 0123 456");
    expect(maskIban("AE070331234567890123456")).toBe("AE07 •••• •••• 3456");
    expect(maskIban(null)).toBe("");
  });
});
