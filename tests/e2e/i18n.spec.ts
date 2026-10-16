import { expect, test } from "@playwright/test";
import { PASSWORD, users } from "./helpers";

test.describe("Arabic / RTL", () => {
  test("switch to Arabic on the login page, sign in, preference is remembered, switch back", async ({ page, context }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await page.getByRole("button", { name: "التبديل إلى العربية" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();

    await page.getByLabel("بريد العمل").fill(users.employee);
    await page.getByLabel("كلمة المرور", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "تسجيل الدخول" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("navigation", { name: "الرئيسية" }).getByRole("link", { name: "لوحة المعلومات" })).toBeVisible();


    // The preference is saved on the user: a fresh browser (no cookie) signs in to Arabic.
    await context.clearCookies();
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await page.getByLabel("Work email").fill(users.employee);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // Back to English from the user menu.
    await page.getByRole("button", { name: "قائمة الحساب" }).click();
    await page.getByRole("menuitem", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" })).toBeVisible();
  });

  test("Arabic payslip page and PDF", async ({ page, context }) => {
    // A language chosen in the browser wins at sign-in (and becomes the saved preference).
    await context.addCookies([{ name: "locale", value: "ar", url: "http://localhost:3000" }]);
    await page.goto("/login");
    await page.getByLabel("بريد العمل").fill(users.employee);
    await page.getByLabel("كلمة المرور", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "تسجيل الدخول" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.goto("/payslips");
    const first = page.getByRole("main").getByRole("link").filter({ hasText: /2026/ }).first();
    await first.click();
    await expect(page.getByText("صافي الراتب").first()).toBeVisible();
    await expect(page.getByText(/درهم/).first()).toBeVisible();
    const id = new URL(page.url()).pathname.split("/").pop();
    const pdf = await page.request.get(`/api/payslips/${id}/pdf`);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    // Leave the user in English for the other specs.
    await page.getByRole("button", { name: "قائمة الحساب" }).click();
    await page.getByRole("menuitem", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });
});
