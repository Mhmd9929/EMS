import { describe, expect, it } from "vitest";
import { amountInWordsAr, integerInWordsAr } from "@/lib/payroll/words";

describe("Arabic amount in words", () => {
  it("writes integers with Arabic agreement", () => {
    expect(integerInWordsAr(0)).toBe("صفر");
    expect(integerInWordsAr(11)).toBe("أحد عشر");
    expect(integerInWordsAr(45)).toBe("خمسة وأربعون");
    expect(integerInWordsAr(3000)).toBe("ثلاثة آلاف");
    expect(integerInWordsAr(12_345)).toBe("اثنا عشر ألفًا وثلاثمائة وخمسة وأربعون");
    expect(integerInWordsAr(200_000)).toBe("مائتا ألف");
    expect(integerInWordsAr(2_500_000)).toBe("مليونان وخمسمائة ألف");
  });

  it("writes UAE Dirham amounts with fils", () => {
    expect(amountInWordsAr(1_234_550, "AED")).toBe("فقط اثنا عشر ألفًا وثلاثمائة وخمسة وأربعون درهمًا إماراتيًا وخمسون فلسًا لا غير");
    expect(amountInWordsAr(100, "AED")).toBe("فقط درهم إماراتي واحد لا غير");
    expect(amountInWordsAr(200, "AED")).toBe("فقط درهمان إماراتيان لا غير");
    expect(amountInWordsAr(500, "AED")).toBe("فقط خمسة دراهم إماراتية لا غير");
    expect(amountInWordsAr(100_000, "AED")).toBe("فقط ألف درهم إماراتي لا غير");
    expect(amountInWordsAr(200_000, "AED")).toBe("فقط ألفا درهم إماراتي لا غير");
    expect(amountInWordsAr(1_500_025, "AED")).toBe("فقط خمسة عشر ألف درهم إماراتي وخمسة وعشرون فلسًا لا غير");
    expect(amountInWordsAr(5, "AED")).toBe("فقط صفر درهم إماراتي وخمسة فلوس لا غير");
    expect(amountInWordsAr(-1_000, "AED")).toBe("فقط سالب عشرة دراهم إماراتية لا غير");
  });

  it("uses feminine numbers for feminine minor units", () => {
    expect(amountInWordsAr(1_003, "SAR")).toBe("فقط عشرة ريالات سعودية وثلاث هللات لا غير");
    expect(amountInWordsAr(1_011, "SAR")).toBe("فقط عشرة ريالات سعودية وإحدى عشرة هللة لا غير");
  });
});
