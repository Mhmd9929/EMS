import { expect, test } from "@playwright/test";
import { login, selectByText, users } from "./helpers";

test.describe("employee management (HR)", () => {
  test.beforeEach(async ({ page }) => login(page, users.hr));

  test("creates an employee; validation errors keep the typed values", async ({ page }) => {
    await page.goto("/employees/new");
    await page.getByLabel("First name").fill("Test");
    await page.getByLabel("Last name").fill("Joiner");
    await page.getByLabel("Work email").fill("test.joiner@falcongulf.ae");
    await page.getByLabel("Join date").fill("2026-11-01");
    await selectByText(page.getByLabel("Department"), "Engineering");
    await selectByText(page.getByLabel("Manager"), "Yousef Qasim");
    await page.getByLabel("IBAN").fill("AE00 1234");
    await page.getByRole("button", { name: "Create employee" }).click();
    await expect(page.getByText(/Invalid IBAN/)).toBeVisible();
    await expect(page.getByLabel("First name")).toHaveValue("Test");

    await page.getByLabel("IBAN").fill("AE07 0331 2345 6789 0123 456");
    await page.getByRole("button", { name: "Create employee" }).click();
    await expect(page).toHaveURL(/\/employees\/[a-z0-9]+\?created=1/);
    await expect(page.getByRole("heading", { name: "Test Joiner" })).toBeVisible();
    await expect(page.getByText("FGT-")).toBeVisible();
  });

  test("prevents reporting loops", async ({ page }) => {
    await page.goto("/employees?q=Khalid");
    await page.getByRole("link", { name: /Khalid Al Mansoori/ }).click();
    await page.getByRole("link", { name: "Edit" }).click();
    await selectByText(page.getByLabel("Manager"), "Sara Al Hammadi");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/reporting loop/)).toBeVisible();
  });

  test("schedules a termination", async ({ page }) => {
    await page.goto("/employees?q=Tom");
    await page.getByRole("link", { name: /Tom Fischer/ }).click();
    await page.getByRole("button", { name: "Terminate" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Last working day").fill("2099-12-31");
    await dialog.getByLabel("Reason").selectOption("Resignation");
    await dialog.getByRole("button", { name: "Confirm termination" }).click();
    await expect(page.getByText("Termination scheduled").first()).toBeVisible();
    await expect(page.getByText("Leaving 31 Dec 2099")).toBeVisible();
  });

  test("imports employees from CSV with a dry run", async ({ page }) => {
    await page.goto("/employees/import");
    const header = "firstName,lastName,workEmail,joinDate,employmentType,departmentCode,managerEmail";
    const bad = `${header}\nBad,Row,not-an-email,2026-01-01,FULL_TIME,NOPE,\n`;
    await page.getByLabel("CSV file").setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from(bad) });
    await page.getByRole("button", { name: "Run dry run" }).click();
    await expect(page.getByText('Unknown department code "NOPE"')).toBeVisible();
    await expect(page.getByRole("button", { name: /^Import/ })).toHaveCount(0);

    const good = `${header}\nCsv,Lead,csv.lead@falcongulf.ae,2026-01-05,FULL_TIME,SAM-MKT,manager@falcongulf.ae\nCsv,Member,csv.member@falcongulf.ae,2026-01-06,PART_TIME,SAM-MKT,csv.lead@falcongulf.ae\n`;
    await page.getByLabel("CSV file").setInputFiles({ name: "good.csv", mimeType: "text/csv", buffer: Buffer.from(good) });
    await page.getByRole("button", { name: "Run dry run" }).click();
    await page.getByRole("button", { name: "Import 2 employees" }).click();
    await expect(page.getByText("Imported 2 employees").first()).toBeVisible();

    await page.goto("/employees?q=Csv");
    await expect(page.getByRole("link", { name: /Csv Member/ })).toBeVisible();
  });

  test("records changes in the audit log", async ({ page }) => {
    await page.goto("/employees?q=Ryan");
    await page.getByRole("link", { name: /Ryan Dsouza/ }).click();
    await page.getByRole("link", { name: "Edit" }).click();
    await page.getByLabel("Mobile phone").fill("+971 50 999 0000");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved.")).toBeVisible();
    await page.goto("/admin/audit?q=phone");
    await expect(page.getByText("Updated phone").first()).toBeVisible();
  });
});
