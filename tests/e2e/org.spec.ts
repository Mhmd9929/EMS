import { expect, test } from "@playwright/test";
import { login, selectByText, users } from "./helpers";

test.describe("organisation", () => {
  test("org chart search focuses a person and opens their card", async ({ page }) => {
    await login(page, users.employee);
    await page.goto("/org-chart");
    await page.getByLabel("Search the org chart").fill("Lucas");
    await page.getByRole("listbox").getByRole("button", { name: /Lucas Moreau/ }).click();
    const node = page.locator("[id^=org-node-]").filter({ hasText: "Lucas Moreau" });
    await expect(node).toHaveClass(/ring-2/); // highlighted after search
    await node.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Lucas Moreau" })).toBeVisible();
    await expect(dialog.getByText("Reports to Elena Petrova")).toBeVisible();
  });

  test("department view toggles", async ({ page }) => {
    await login(page, users.employee);
    await page.goto("/org-chart");
    await page.getByRole("tab", { name: "Departments" }).click();
    await expect(page.locator("[id^=org-node-]").filter({ hasText: "Engineering" })).toBeVisible();
  });

  test("HR creates a department and cannot nest it under its own child", async ({ page }) => {
    await login(page, users.hr);
    await page.goto("/organization/departments");
    await page.getByRole("button", { name: "New department" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Quality Assurance");
    await dialog.getByRole("textbox", { name: "Code", exact: true }).fill("TECH-QA");
    await selectByText(dialog.getByLabel("Parent department"), "Technology");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("cell", { name: "Quality Assurance", exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Edit Technology" }).click();
    dialog = page.getByRole("dialog");
    await selectByText(dialog.getByLabel("Parent department"), "Quality Assurance");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText(/cannot sit under itself/)).toBeVisible();
  });
});
