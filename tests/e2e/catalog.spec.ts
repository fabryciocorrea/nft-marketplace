import { test, expect } from "@playwright/test";

test.describe("Catálogo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("lista os NFTs vindos da API simulada", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Cosmic Genesis #001" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ethereal Cyber Punk" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Abstract Dimensions #4" }),
    ).toBeVisible();
  });

  test("busca por texto filtra os resultados", async ({ page }) => {
    await page.getByPlaceholder("Pesquisar NFTs...").fill("cyber");
    await expect(
      page.getByRole("heading", { name: "Ethereal Cyber Punk" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cosmic Genesis #001" }),
    ).toHaveCount(0);
  });

  test("filtros de categoria e busca se combinam, com estado vazio", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Art", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Cosmic Genesis #001" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ethereal Cyber Punk" }),
    ).toHaveCount(0);

    await page
      .getByRole("button", { name: "Collectibles", exact: true })
      .click();
    await page.getByPlaceholder("Pesquisar NFTs...").fill("cosmic");
    await expect(
      page.getByText("Nenhum NFT encontrado com essa pesquisa."),
    ).toBeVisible();
  });
});
