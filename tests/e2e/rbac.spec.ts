import { expect, test } from "@playwright/test";
import { forbidden, login, users } from "./helpers";

test.describe("role-based access (server enforced)", () => {
  test("an employee cannot reach HR or admin pages, even by URL", async ({ page }) => {
    await login(page, users.employee);
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Employees" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Audit log" })).toHaveCount(0);
    for (const path of ["/employees", "/employees/new", "/employees/import", "/admin/users", "/admin/roles", "/admin/audit", "/admin/settings", "/organization/departments"]) {
      await page.goto(path);
      await forbidden(page);
    }
  });

  test("an employee cannot open another employee's record or export data", async ({ page, request }) => {
    await login(page, users.manager);
    // find the HR manager's id via the directory card's profile link is not offered to non-HR; use HR session
    await page.goto("/directory?q=Mariam");
    await page.getByRole("button", { name: /Mariam Al Zaabi/ }).click();
    await expect(page.getByRole("link", { name: "Open full profile" })).toHaveCount(0);

    await page.context().clearCookies();
    await login(page, users.hr);
    await page.goto("/employees?q=Mariam");
    await page.getByRole("link", { name: /Mariam Al Zaabi/ }).first().click();
    const hrProfileUrl = page.url();

    await page.context().clearCookies();
    await login(page, users.employee);
    await page.goto(hrProfileUrl);
    await forbidden(page);

    const res = await page.request.get("/api/employees/export");
    expect(res.status()).toBe(403);
    void request;
  });

  test("the directory never shows bank or identity numbers", async ({ page }) => {
    await login(page, users.employee);
    await page.goto("/directory?view=table&pageSize=100");
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/AE\d{2}\s?\d{4}/); // IBAN
    expect(text).not.toMatch(/784-\d{4}/); // Emirates ID
  });

  test("a manager sees only their team, with sensitive fields masked", async ({ page }) => {
    await login(page, users.manager);
    await page.goto("/employees");
    await expect(page.getByRole("heading", { name: "My team" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sara Al Hammadi/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Lucas Moreau/ })).toBeVisible(); // indirect report
    await expect(page.getByRole("link", { name: /Mariam Al Zaabi/ })).toHaveCount(0);

    await page.getByRole("link", { name: /Sara Al Hammadi/ }).click();
    await expect(page.getByRole("link", { name: "Documents" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Payroll" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  });

  test("HR cannot change roles or company settings; Super Admin can", async ({ page }) => {
    await login(page, users.hr);
    await page.goto("/admin/roles");
    await forbidden(page);
    await page.context().clearCookies();
    await login(page, users.admin);
    await page.goto("/admin/roles");
    await expect(page.getByRole("heading", { name: "Roles & permissions" })).toBeVisible();
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Company settings" })).toBeVisible();
  });
});
