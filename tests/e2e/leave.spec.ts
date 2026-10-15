import { expect, test, type Page } from "@playwright/test";
import { DOMAIN, forbidden, login, users } from "./helpers";

/** Monday on/after today + `offset` days, and the following weekdays (YYYY-MM-DD, UTC). */
function weekFrom(offset: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const plus = (n: number) => new Date(d.getTime() + n * 86_400_000);
  return { mon: iso(d), wed: iso(plus(2)), fri: iso(plus(4)), sat: iso(plus(5)), sun: iso(plus(6)) };
}

async function annualTaken(page: Page) {
  await page.goto("/leave");
  const card = page.getByTestId("balance-AL");
  return {
    taken: Number((await card.locator("[data-field=taken]").innerText()).replace("−", "")),
    pending: Number((await card.locator("[data-field=pending]").innerText()).replace("−", "")),
  };
}

async function apply(page: Page, type: string, start: string, end: string) {
  await page.goto("/leave/apply");
  await page.getByLabel("Leave type").selectOption({ label: type });
  await page.getByLabel("First day").fill(start);
  await page.getByLabel("Last day").fill(end);
}

test.describe("leave management", () => {
  test("apply → live preview → manager approves → balance updated → employee notified", async ({ page }) => {
    const week = weekFrom(35);
    await login(page, users.employee);
    const before = await annualTaken(page);

    await apply(page, "Annual Leave", week.mon, week.fri);
    const summary = page.getByRole("complementary");
    await expect(summary.getByText("5 days", { exact: true })).toBeVisible();
    await expect(summary.getByText("Remaining after")).toBeVisible();
    await page.getByLabel("Reason").fill("E2E holiday");
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page).toHaveURL(/\/leave\/requests\/\w+\?submitted=1/);
    await expect(page.getByText("Request submitted")).toBeVisible();
    const requestUrl = page.url().split("?")[0];

    const afterSubmit = await annualTaken(page);
    expect(afterSubmit.pending).toBe(before.pending + 5);

    // Manager approves from the inbox
    await page.context().clearCookies();
    await login(page, users.manager);
    await page.goto(requestUrl);
    await page.getByLabel("Comment").fill("Enjoy!");
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 }).getByText("Approved")).toBeVisible();

    // Employee sees it approved, the balance moved from pending to taken, and has a notification
    await page.context().clearCookies();
    await login(page, users.employee);
    const after = await annualTaken(page);
    expect(after.taken).toBe(before.taken + 5);
    expect(after.pending).toBe(before.pending);
    await page.getByRole("button", { name: /Notifications \(\d+ unread\)/ }).click();
    await expect(page.getByRole("menuitem", { name: /Annual Leave approved/ }).first()).toBeVisible();
  });

  test("weekends and holidays are excluded; weekend-only requests cannot be submitted", async ({ page }) => {
    const week = weekFrom(49);
    await login(page, users.employee);
    await apply(page, "Annual Leave", week.wed, week.sun);
    await expect(page.getByRole("complementary").getByText("3 days", { exact: true })).toBeVisible();
    await page.getByLabel("First day").fill(week.sat);
    await page.getByLabel("Last day").fill(week.sun);
    await expect(page.getByRole("complementary").getByText(/all weekends or public holidays/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit request" })).toBeDisabled();
  });

  test("overlapping requests are blocked and pending requests can be withdrawn", async ({ page }) => {
    const week = weekFrom(63);
    await login(page, users.employee);
    await apply(page, "Annual Leave", week.mon, week.wed);
    await expect(page.getByRole("complementary").getByText("3 days", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page).toHaveURL(/submitted=1/);
    const url = page.url().split("?")[0];

    await apply(page, "Annual Leave", week.wed, week.fri);
    await expect(page.getByRole("complementary").getByText(/Overlaps your Annual Leave request/)).toBeVisible();

    await page.goto(url);
    await page.getByRole("button", { name: "Withdraw request" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Withdraw" }).click();
    await expect(page.getByRole("heading", { level: 1 }).getByText("Cancelled")).toBeVisible();
  });

  test("multi-level approval: manager then HR", async ({ page }) => {
    // Seeded: Elena's Study Leave was approved by her manager and waits for HR.
    await login(page, users.hr);
    await page.goto("/leave/approvals");
    await page.getByRole("link", { name: "Elena Petrova" }).filter({ hasText: "Elena Petrova" }).first().click();
    await expect(page.getByText("HR approval")).toBeVisible();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 }).getByText("Approved")).toBeVisible();
  });

  test("manager bulk-approves and rejection requires a reason", async ({ page }) => {
    await login(page, users.manager);
    await page.goto("/leave/approvals");
    const rows = page.getByRole("checkbox", { name: /Select .*'s request/ });
    const count = await rows.count();
    expect(count).toBeGreaterThan(1);

    // Rejecting without a comment is refused
    await rows.first().check();
    await page.getByRole("button", { name: "Reject selected" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reject" }).click();
    expect(await page.getByRole("dialog").getByLabel("Comment").evaluate((el: HTMLTextAreaElement) => el.validity.valueMissing)).toBe(true);
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("checkbox", { name: "Select all" }).check();
    await page.getByRole("button", { name: "Approve selected" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText(new RegExp(`Approved ${count} requests`))).toBeVisible();
    await expect(page.getByText("Nothing waiting for you")).toBeVisible();
  });

  test("delegate approves on behalf of the manager", async ({ page }) => {
    const week = weekFrom(42);
    // Employee applies
    await login(page, users.employee);
    await apply(page, "Annual Leave", week.mon, week.mon);
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page).toHaveURL(/submitted=1/);
    const url = page.url().split("?")[0];

    // Manager delegates to the Systems Administrator
    await page.context().clearCookies();
    await login(page, users.manager);
    await page.goto("/leave/approvals");
    await page.getByLabel("Delegate").selectOption({ label: "Hamdan Al Falasi — Systems Administrator" });
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel("Until").fill(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
    await page.getByLabel("From").fill(today);
    await page.getByRole("button", { name: "Delegate approvals" }).click();
    await expect(page.getByText("Delegation created.")).toBeVisible();

    // The delegate (Super Admin user without leave permissions of their own) sees and approves it
    await page.context().clearCookies();
    await login(page, users.admin);
    await page.goto("/leave/approvals");
    await expect(page.getByText(/for Yousef Qasim/).first()).toBeVisible();
    await page.goto(url);
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 }).getByText("Approved")).toBeVisible();
    await expect(page.getByText(/\(delegate\)/)).toBeVisible();
  });

  test("HR adjusts a balance with a mandatory reason and it is audited", async ({ page }) => {
    await login(page, users.hr);
    await page.goto("/leave/balances?q=Sara");
    await page.getByRole("button", { name: /Adjust Sara Al Hammadi's balance/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Days").fill("2");
    await dialog.getByRole("button", { name: "Save adjustment" }).click();
    expect(await dialog.getByLabel("Reason").evaluate((el: HTMLTextAreaElement) => el.validity.valueMissing)).toBe(true);
    await dialog.getByLabel("Reason").fill("Worked on National Day");
    await dialog.getByRole("button", { name: "Save adjustment" }).click();
    await expect(page.getByText("Balance adjusted.")).toBeVisible();
    await page.goto("/admin/audit?q=National");
    await expect(page.getByText(/Worked on National Day/).first()).toBeVisible();
  });

  test("employees cannot reach HR leave pages; calendars hide colleagues' leave types", async ({ page }) => {
    await login(page, users.employee);
    for (const path of ["/leave/balances", "/leave/settings", "/leave/reports", "/leave/requests"]) {
      await page.goto(path);
      await forbidden(page);
    }
    expect((await page.request.get("/api/leave/balances")).status()).toBe(403);
    await page.goto("/leave/calendar");
    await expect(page.getByRole("heading", { name: "Leave calendar" })).toBeVisible();
    // Colleagues appear only as "On leave"
    const labels = await page.locator("td [aria-label]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
    expect(labels.filter((l) => !l.startsWith("Sara")).every((l) => l.includes("On leave"))).toBe(true);
    void DOMAIN;
  });
});
