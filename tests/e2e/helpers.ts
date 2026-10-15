import type { Page } from "@playwright/test";

export const LARISSA = { email: "larissa@exemplo.com", password: "Senha@123" };

export async function login(
  page: Page,
  email = LARISSA.email,
  password = LARISSA.password,
) {
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("E-mail").fill(email);
  await dialog.getByLabel("Senha").fill(password);
  await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
}
