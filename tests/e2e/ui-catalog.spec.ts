import { expect, test } from "@playwright/test";
import { boot, openFilters, setScenario } from "./helpers";

test.describe("UI · catálogo", () => {
  test("busca e filtros ficam na URL e sobrevivem ao refresh", async ({ page }) => {
    await boot(page);
    await page.getByLabel("Buscar NFTs").fill("cosmic");
    await expect(page).toHaveURL(/q=cosmic/);
    await expect(page.getByTestId("result-count")).toContainText("4 resultados");

    await page.reload();
    await expect(page.getByLabel("Buscar NFTs")).toHaveValue("cosmic");
    await expect(page.getByTestId("result-count")).toContainText("4 resultados");
    await expect(
      page.getByRole("heading", { name: "Cosmic Genesis #001" }),
    ).toBeVisible();
  });

  test("facetas com contagem, filtros combinados e limpar", async ({ page }) => {
    await boot(page);
    await openFilters(page);
    const panel = page.getByRole("dialog", { name: "Filtros do catálogo" });

    // marca coleção e rede: a URL reflete e o resultado reduz
    await panel.getByLabel(/Pixel Forest/).check();
    await expect(page).toHaveURL(/collection=pixel/);
    const afterCollection = await page.getByTestId("result-count").innerText();
    expect(afterCollection).toMatch(/^\d+ resultado/);

    await panel.getByLabel(/Ethereum/).check();
    await expect(page).toHaveURL(/network=Ethereum/);
    await expect(page.getByTestId("result-count")).not.toHaveText(afterCollection);

    await panel.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page).not.toHaveURL(/collection=/);
    await expect(page.getByTestId("result-count")).toContainText("27 resultados");
  });

  test("a contagem exibida na faceta bate com o resultado ao filtrar", async ({
    page,
  }) => {
    await boot(page, "/");
    await openFilters(page);
    const panel = page.getByRole("dialog", { name: "Filtros do catálogo" });
    const label = panel.getByLabel(/Neo Tokyo/);
    const text = await panel.locator("label", { hasText: "Neo Tokyo" }).innerText();
    const count = Number(/\((\d+)\)/.exec(text)![1]);
    await label.check();
    await expect(page.getByTestId("result-count")).toContainText(
      `${count} resultado`,
    );
  });

  test("faixa de preço, ordenação e categorias", async ({ page }) => {
    await boot(page, "/?sort=price_asc");
    await openFilters(page);
    await expect(page.locator("[data-testid^=nft-card-]").first()).toContainText(
      "Micro Fragment #1",
    );

    const panel = page.getByRole("dialog", { name: "Filtros do catálogo" });
    await panel.getByLabel("Preço mínimo").fill("1");
    await panel.getByLabel("Preço máximo").fill("2");
    await panel.getByLabel("Preço máximo").press("Enter");
    await expect(page).toHaveURL(/minPrice=1/);
    await expect(page).toHaveURL(/maxPrice=2/);
    for (const price of await page.locator("[data-testid^=nft-card-]").allInnerTexts()) {
      const eth = Number(/([\d.]+) ETH/.exec(price)![1]);
      expect(eth).toBeGreaterThanOrEqual(1);
      expect(eth).toBeLessThanOrEqual(2);
    }

    await panel.getByLabel("Ordenar por").selectOption("price_desc");
    await expect(page).toHaveURL(/sort=price_desc/);

    await panel.getByRole("tab", { name: /^Gaming/ }).click();
    await expect(page).toHaveURL(/tab=Gaming/);
  });

  test("paginação preserva filtros e volta à página 1 ao filtrar", async ({
    page,
  }) => {
    await boot(page);
    await expect(page.getByTestId("page-indicator")).toHaveText("Página 1 de 3");
    await page.getByRole("button", { name: "Próxima" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId("page-indicator")).toHaveText("Página 2 de 3");

    await page.reload();
    await expect(page.getByTestId("page-indicator")).toHaveText("Página 2 de 3");

    const dropdown = await openFilters(page);
    await dropdown.getByLabel(/Ethereum/).check();
    await expect(page).not.toHaveURL(/page=2/);
  });

  test("estado vazio com ação para limpar a busca", async ({ page }) => {
    await boot(page, "/?q=zzzzzz");
    await expect(page.getByText("Nenhum NFT encontrado")).toBeVisible();
    await page
      .getByRole("main")
      .getByRole("button", { name: "Limpar filtros" })
      .first()
      .click();
    await expect(page.getByTestId("result-count")).toContainText("27 resultados");
  });

  test("skeleton durante o carregamento lento", async ({ page }) => {
    await boot(page);
    await setScenario(page, { latencyMs: 1500 });
    await openFilters(page);
    await page
      .getByRole("dialog", { name: "Filtros do catálogo" })
      .getByLabel(/Pixel Forest/)
      .check();
    // a lista antiga continua visível; o contador mostra o novo total ao final
    await expect(page.getByTestId("result-count")).toContainText("resultado", {
      timeout: 10_000,
    });

    await page.goto("/?q=ocean");
    await expect(page.getByTestId("catalog-skeleton")).toBeVisible();
    await expect(page.getByTestId("catalog-skeleton")).toBeHidden({
      timeout: 10_000,
    });
  });

  test("erro da API mostra alerta e permite tentar de novo", async ({ page }) => {
    await boot(page);
    await setScenario(page, { serverError: true });
    await page.goto("/?q=erro");
    await expect(page.getByRole("alert")).toContainText("Erro ao carregar o catálogo");

    await setScenario(page, { serverError: false });
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.getByTestId("result-count")).toContainText("resultado");
  });

  test("detalhe do NFT: dados, esgotado e 404", async ({ page }) => {
    await boot(page, "/nfts/1");
    await expect(
      page.getByRole("heading", { level: 1, name: "Cosmic Genesis #001" }),
    ).toBeVisible();
    await expect(page.getByTestId("detail-price")).toHaveText("0.85 ETH");
    await expect(page.getByTestId("detail-stock")).toHaveText("5");
    await expect(page.getByRole("heading", { name: "Avaliações" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "NFTs relacionados" })).toBeVisible();

    await page.goto("/nfts/27");
    await expect(page.getByText("Este NFT está esgotado.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Adicionar ao carrinho" }),
    ).toBeDisabled();

    await page.goto("/nfts/9999");
    await expect(page.getByText("NFT não encontrado")).toBeVisible();
  });

  test("clicar em um card abre a página de detalhe", async ({ page }) => {
    await boot(page);
    await page
      .getByTestId("nft-card-1")
      .getByRole("heading", { name: "Cosmic Genesis #001" })
      .getByRole("link")
      .click();
    await expect(page).toHaveURL(/\/nfts\/1$/);
  });

  test("rota inexistente mostra página não encontrada", async ({ page }) => {
    await boot(page, "/nao-existe");
    await expect(page.getByText("Página não encontrada")).toBeVisible();
  });
});
