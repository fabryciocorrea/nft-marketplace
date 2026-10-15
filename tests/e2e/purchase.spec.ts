import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Carrinho e compra", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("o carrinho persiste após refresh", async ({ page }) => {
    await page
      .getByTestId("nft-card-1")
      .getByRole("button", { name: "Comprar" })
      .click();
    await expect(
      page.getByRole("button", { name: /Carrinho\s*1/ }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("button", { name: /Carrinho\s*1/ }),
    ).toBeVisible();
  });

  test("a quantidade não ultrapassa a disponibilidade do NFT", async ({
    page,
  }) => {
    // "Ethereal Cyber Punk" tem 2 unidades disponíveis
    const comprar = page
      .getByTestId("nft-card-2")
      .getByRole("button", { name: "Comprar" });
    await comprar.click();
    await comprar.click();
    await comprar.click();
    await expect(
      page.getByRole("button", { name: /Carrinho\s*2/ }),
    ).toBeVisible();
  });

  test("sem login, o checkout pede autenticação", async ({ page }) => {
    await page
      .getByTestId("nft-card-1")
      .getByRole("button", { name: "Comprar" })
      .click();
    await page.getByRole("button", { name: /Carrinho/ }).click();
    await page.getByRole("button", { name: "Entrar para comprar" }).click();
    await expect(
      page.getByRole("heading", { name: "Entrar na Conta" }),
    ).toBeVisible();
  });

  test("compra completa: do catálogo ao recibo confirmado", async ({
    page,
  }) => {
    await login(page);
    await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();

    await page
      .getByTestId("nft-card-3")
      .getByRole("button", { name: "Comprar" })
      .click();
    await page.getByRole("button", { name: /Carrinho/ }).click();
    await page.getByRole("button", { name: "Finalizar Compra" }).click();

    // Pedido começa pendente e só depois é confirmado
    await expect(page.getByText("Processando o seu pedido...")).toBeVisible();
    await expect(page.getByText("Pedido confirmado!")).toBeVisible({
      timeout: 10_000,
    });

    // 0.45 (NFT) + 0.0021 (taxa de rede) = 0.4521
    await expect(page.getByText("0.4521 ETH")).toBeVisible();

    // O carrinho só esvazia depois da confirmação
    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await page.getByRole("button", { name: /Carrinho/ }).click();
    await expect(page.getByText("O seu carrinho está vazio.")).toBeVisible();
  });

  test("recupera o pedido pendente após refresh sem criar outro", async ({
    page,
  }) => {
    await login(page);
    await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();

    await page
      .getByTestId("nft-card-3")
      .getByRole("button", { name: "Comprar" })
      .click();
    await page.getByRole("button", { name: /Carrinho/ }).click();
    await page.getByRole("button", { name: "Finalizar Compra" }).click();
    await expect(page.getByText("Processando o seu pedido...")).toBeVisible();

    await page.reload();

    await expect(page.getByText("Pedido confirmado!")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Pedido ord_/)).toHaveCount(1);
  });
});
