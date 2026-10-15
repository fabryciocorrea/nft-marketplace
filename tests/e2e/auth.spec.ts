import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Autenticação", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("senha errada mostra o erro retornado pela API", async ({ page }) => {
    await login(page, "larissa@exemplo.com", "senha-errada");
    await expect(page.getByRole("alert")).toHaveText(
      "E-mail ou senha inválidos.",
    );
    await expect(page.getByRole("button", { name: "Sair" })).toHaveCount(0);
  });

  test("login válido mantém a sessão após refresh", async ({ page }) => {
    await login(page);
    await expect(page.getByText("Larissa Rosa")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Larissa Rosa")).toBeVisible();
  });

  test("logout encerra a sessão e limpa o carrinho", async ({ page }) => {
    await login(page);
    await expect(page.getByText("Larissa Rosa")).toBeVisible();

    await page
      .getByTestId("nft-card-1")
      .getByRole("button", { name: "Comprar" })
      .click();
    await expect(
      page.getByRole("button", { name: /Carrinho\s*1/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(
      page.getByRole("button", { name: "Entrar", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Carrinho\s*1/ }),
    ).toHaveCount(0);

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Entrar", exact: true }),
    ).toBeVisible();
  });
});
