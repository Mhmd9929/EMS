import { expect, test, type Page } from "@playwright/test";
import { forbidden, login, logout, users } from "./helpers";

const now = new Date();
const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Asia/Dubai" }).format(now);

async function hold(page: Page, name: string) {
  await page.getByRole("button", { name: `Change status of ${name}` }).click();
  await page.getByRole("menuitem", { name: /Hold salary/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reason").fill("Bank details pending");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: `Change status of ${name}` })).toContainText("Held");
}

test.describe.serial("payroll", () => {
  let runUrl = "";
  let othersPayslipUrl = "";

  test("payroll admin creates, calculates and submits the monthly run; cannot approve it", async ({ page }) => {
    test.slow();
    await login(page, users.payroll);
    await page.goto("/payroll");
    await page.getByRole("button", { name: "New payroll run" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Create run" }).click();
    await expect(page).toHaveURL(/\/payroll\/runs\/[a-z0-9]+$/, { timeout: 60_000 }); // first visit compiles the page in dev
    runUrl = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { name: new RegExp(`${monthLabel} payroll`) })).toBeVisible();

    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Employees paid")).toBeVisible();
    // New joiners without an IBAN block submission until held.
    await expect(page.getByText(/blocking issue/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit for approval" })).toBeDisabled();
    // Hold everyone with a blocking issue (the seeded joiners, plus any employee other specs created without an IBAN).
    await page.goto(`${runUrl}?view=issues`);
    const blocked = page.getByRole("row").filter({ hasText: "No IBAN" }).filter({ has: page.getByRole("button", { name: /Change status of/ }).filter({ hasText: "Included" }) });
    const names = await blocked.getByRole("link").allInnerTexts();
    expect(names).toEqual(expect.arrayContaining(["Omar Bin Rashid", "Leena Thomas"]));
    for (const name of names) await hold(page, name);
    await expect(page.getByText(/blocking issue/)).toBeHidden();
    await page.goto(runUrl);

    // Breakdown of one employee
    await page.getByRole("link", { name: "Sara Al Hammadi" }).click();
    await expect(page.getByRole("heading", { name: /Sara Al Hammadi/ })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Basic salary" })).toBeVisible();
    await page.goto(runUrl);

    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(page.getByText("Under review").first()).toBeVisible();
    // Maker-checker: the person who prepared the run cannot approve it.
    await expect(page.getByText("Waiting for a second approver")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  });

  test("a second person approves, the payroll admin releases", async ({ page }) => {
    await login(page, users.admin);
    await page.goto(runUrl);
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Comment").fill("Variances checked");
    await dialog.getByRole("button", { name: "Approve" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: /WPS SIF/ })).toBeVisible();
    await logout(page);

    await login(page, users.payroll);
    await page.goto(runUrl);
    const register = page.waitForEvent("download");
    await page.getByRole("link", { name: /Register \(Excel\)/ }).click();
    expect((await register).suggestedFilename()).toMatch(/^payroll-register-\d{4}-\d{2}\.xlsx$/);
    const sif = await page.request.get(`/api${runUrl}/export?type=sif`);
    expect(sif.status()).toBe(200);
    expect(await sif.text()).toMatch(/^EDR,/m);

    await page.getByRole("button", { name: "Release payroll" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Release" }).click();
    await expect(page.getByRole("heading", { name: /payroll/ }).getByText("Released")).toBeVisible();

    // Remember another employee's payslip URL for the isolation test.
    await page.getByRole("link", { name: "Yousef Qasim" }).click();
    await page.getByRole("main").getByRole("link", { name: "Payslip", exact: true }).click();
    await expect(page.getByRole("heading", { name: new RegExp(`Payslip — ${monthLabel}`) })).toBeVisible();
    othersPayslipUrl = new URL(page.url()).pathname;
  });

  test("employee sees and downloads their own payslip", async ({ page }) => {
    await login(page, users.employee);
    await page.goto("/payslips");
    await page.getByRole("link", { name: monthLabel, exact: true }).click();
    await expect(page.getByRole("heading", { name: `Payslip — ${monthLabel}` })).toBeVisible();
    await expect(page.getByText("Net pay").first()).toBeVisible();
    await expect(page.getByText(/UAE Dirhams .*Only/)).toBeVisible();
    const id = new URL(page.url()).pathname.split("/").pop();
    const pdf = await page.request.get(`/api/payslips/${id}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("employee cannot open another employee's payslip, PDF or payroll pages", async ({ page }) => {
    expect(othersPayslipUrl).toMatch(/^\/payslips\//);
    await login(page, users.employee);
    await page.goto(othersPayslipUrl);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    const pdf = await page.request.get(`/api${othersPayslipUrl}/pdf`);
    expect(pdf.status()).toBe(404);
    const exp = await page.request.get(`/api${runUrl}/export?type=register`);
    expect(exp.status()).toBe(403);
    for (const path of ["/payroll", runUrl, "/payroll/salaries", "/payroll/settings"]) {
      await page.goto(path);
      await forbidden(page);
    }
  });
});
