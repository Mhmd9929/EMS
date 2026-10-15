import { expect, type Locator, type Page } from "@playwright/test";

export const DOMAIN = "falcongulf.ae";
export const PASSWORD = "Demo@12345";
export const users = {
  admin: `admin@${DOMAIN}`,
  hr: `hr@${DOMAIN}`,
  payroll: `payroll@${DOMAIN}`,
  manager: `manager@${DOMAIN}`,
  employee: `employee@${DOMAIN}`,
};

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

export const forbidden = (page: Page) => expect(page.getByRole("heading", { name: /403/ })).toBeVisible();

/** The inline error banner of the form on the page (excludes Next's route announcer). */
export const formAlert = (page: Page) => page.locator("form [role=alert]");

/** Select the first <option> whose text contains `text` (labels may be indented with nbsp). */
export async function selectByText(select: Locator, text: string) {
  const value = await select.locator("option", { hasText: text }).first().getAttribute("value");
  await select.selectOption(value!);
}
