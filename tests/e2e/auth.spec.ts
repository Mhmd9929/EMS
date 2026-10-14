import { expect, test } from "@playwright/test";
import { formAlert, login, logout, users, DOMAIN } from "./helpers";

test.describe("authentication", () => {
  test("redirects to login and back to the requested page", async ({ page }) => {
    await page.goto("/directory");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdirectory/);
    await page.getByLabel("Work email").fill(users.employee);
    await page.getByLabel("Password", { exact: true }).fill("Demo@12345");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/directory$/);
    await expect(page.getByRole("heading", { name: "Company directory" })).toBeVisible();
  });

  test("rejects a wrong password without revealing which part was wrong", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(users.employee);
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(formAlert(page)).toHaveText("Invalid email or password.");
  });

  test("logs in and out", async ({ page }) => {
    await login(page, users.hr);
    await expect(page.getByRole("heading", { name: /Welcome back, Mariam/ })).toBeVisible();
    await logout(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("forces a password change on first login", async ({ page }) => {
    await login(page, `new.joiner@${DOMAIN}`, "Welcome@2026");
    await expect(page).toHaveURL(/\/change-password/);
    // Other pages are blocked until the password is changed
    await page.goto("/directory");
    await expect(page).toHaveURL(/\/change-password/);
    await page.getByLabel("Current password").fill("Welcome@2026");
    await page.getByLabel("New password").fill("BrandNew@2026");
    await page.getByLabel("Confirm password").fill("BrandNew@2026");
    await page.getByRole("button", { name: "Set password" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Welcome back, Omar/ })).toBeVisible();
  });

  test("throttles repeated failed logins", async ({ page }) => {
    await page.goto("/login");
    for (let i = 0; i < 5; i++) {
      await page.getByLabel("Work email").fill(`nobody@${DOMAIN}`);
      await page.getByLabel("Password", { exact: true }).fill(`wrong-${i}`);
      // Wait for each attempt's response so attempts don't overlap.
      await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/login")), page.getByRole("button", { name: "Sign in" }).click()]);
      await expect(formAlert(page)).toHaveText("Invalid email or password.");
    }
    await page.getByLabel("Work email").fill(`nobody@${DOMAIN}`);
    await page.getByLabel("Password", { exact: true }).fill("wrong-again");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(formAlert(page)).toContainText("Too many failed attempts");
  });

  test("forgot password never reveals whether an account exists", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Work email").fill(`ghost@${DOMAIN}`);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If an account exists for that email")).toBeVisible();
  });

  test("terminated employees cannot sign in", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(`george.abraham@${DOMAIN}`);
    await page.getByLabel("Password", { exact: true }).fill("Demo@12345");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(formAlert(page)).toHaveText("Your account is disabled. Contact HR.");
  });
});
