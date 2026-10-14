import { expect, test } from "@playwright/test";
import { login, users } from "./helpers";

test("an employee updates their own contact details and emergency contacts", async ({ page }) => {
  await login(page, users.employee);
  await page.goto("/profile");
  await page.getByLabel("Mobile phone").fill("+971 55 123 4567");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Mobile phone")).toHaveValue("+971 55 123 4567");

  await page.getByRole("button", { name: "Add contact" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Khalifa Al Hammadi");
  await dialog.getByLabel("Relationship").fill("Brother");
  await dialog.getByLabel("Phone").fill("+971 50 765 4321");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Khalifa Al Hammadi")).toBeVisible();
});
