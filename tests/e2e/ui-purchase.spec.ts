import { expect, test } from "@playwright/test";
import {
  BLOCKED,
  CHAVES,
  LARISSA,
  api,
  apiLogin,
  boot,
  mocks,
  setScenario,
  uiLogin,  logout,
  toasts,
} from "./helpers";

test.describe("UI · carrinho", () => {
  test("visitante: adiciona, ajusta quantidade, persiste e respeita estoque", async ({
    page,
  }) => {
    await boot(page, "/nfts/2");
    await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.reload();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.goto("/cart");
    await expect(page.getByTestId("qty-2")).toHaveText("1");
    await page.getByRole("button", { name: /Aumentar quantidade/ }).click();
    await expect(page.getByTestId("qty-2")).toHaveText("2");
    // NFT 2 só tem 2 edições: o + é bloqueado
    await expect(
      page.getByRole("button", { name: /Aumentar quantidade/ }),
    ).toBeDisabled();
    await expect(page.getByTestId("cart-subtotal")).toHaveText("2.4 ETH");

    await page.getByRole("button", { name: /Diminuir quantidade/ }).click();
    await expect(page.getByTestId("qty-2")).toHaveText("1");
    await page.getByRole("button", { name: /Remover .* do carrinho/ }).click();
    await expect(page.getByText("Seu carrinho está vazio")).toBeVisible();
  });

  test("soma decimal exata no subtotal", async ({ page }) => {
    await boot(page);
    // 0.85 + 1.20 + 0.45 = 2.5 (com Number daria 2.5000000000000004 em somas ingênuas)
    for (const id of ["1", "2", "3"]) {
      await page.getByRole("button", { name: new RegExp(`Adicionar .* ao carrinho`) }).first();
      await page.goto(`/nfts/${id}`);
      await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
    }
    await page.goto("/cart");
    await expect(page.getByTestId("cart-subtotal")).toHaveText("2.5 ETH");
  });

  test("login mescla o carrinho do visitante no do servidor", async ({ page }) => {
    await boot(page, "/nfts/3");
    await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toHaveText("Larissa Rosa");
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    // o servidor guarda o carrinho: abre em outro "dispositivo" (sem o store local)
    const token = await page.evaluate(() =>
      localStorage.getItem("nft-marketplace:token"),
    );
    const cart = await api(page, "GET", "/cart", { token: token! });
    expect(cart.body.items.map((i: any) => i.id)).toEqual(["3"]);
    const anon = await page.evaluate(() =>
      localStorage.getItem("nft-marketplace:cart"),
    );
    expect(JSON.parse(anon!).state.items).toEqual([]);
  });

  test("sair limpa o estado privado; outro usuário não vê o carrinho", async ({
    page,
  }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await page.goto("/nfts/3");
    await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await logout(page);
    await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("0");

    await uiLogin(page, CHAVES);
    await expect(page.getByTestId("user-name")).toHaveText("Chaves do 8");
    await expect(page.getByTestId("cart-count")).toHaveText("0");
  });
});

test.describe("UI · rotas privadas", () => {
  test("visitante é enviado ao login e retorna ao contexto original", async ({
    page,
  }) => {
    await boot(page, "/checkout");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/);
    await page.getByLabel("E-mail").fill(LARISSA.email);
    await page.getByLabel("Senha").fill(LARISSA.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/checkout$/);
  });

  test("redirect externo é ignorado", async ({ page }) => {
    await uiLogin(page, LARISSA, "//malicioso.example");
    await expect(page.getByTestId("user-name")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("credenciais inválidas mostram o erro da API", async ({ page }) => {
    await uiLogin(page, { email: LARISSA.email, password: "errada" });
    await expect(page.getByTestId("login-error")).toContainText(
      "E-mail ou senha inválidos",
    );
  });

  test("validação do formulário de login (Zod)", async ({ page }) => {
    await boot(page, "/login");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText("Informe o e-mail.")).toBeVisible();
    await expect(page.getByText("Informe a senha.")).toBeVisible();
  });

  test("sessão persiste após refresh", async ({ page }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("user-name")).toHaveText("Larissa Rosa");
  });
});

test.describe("UI · checkout e pedido", () => {
  async function fillCart(page: import("@playwright/test").Page, nftId = "1") {
    await page.goto(`/nfts/${nftId}`);
    await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
    await expect(page.getByTestId("cart-count")).not.toHaveText("0");
  }

  test("compra completa: carteira, cotação, confirmação em tempo real e estoque", async ({
    page,
  }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await fillCart(page, "1");

    await page.goto("/cart");
    await page.getByRole("button", { name: "Ir para o pagamento" }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    await expect(page.getByTestId("quote-total")).toHaveText("0.8521 ETH");
    await expect(page.getByTestId("quote-fee")).toHaveText("0.0021 ETH");

    // trocar para a carteira Polygon recalcula a taxa
    await page.getByLabel(/Secundária/).check();
    await expect(page.getByTestId("quote-fee")).toHaveText("0.00042 ETH");
    await expect(page.getByTestId("quote-total")).toHaveText("0.85042 ETH");

    await page.getByLabel("Código do cupom").fill("promo10");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByTestId("quote-discount")).toHaveText("0.085 ETH");
    await expect(page.getByTestId("quote-total")).toHaveText("0.76542 ETH");

    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page).toHaveURL(/\/order\/ord_/);

    // confirmação chega por evento (order.updated)
    await expect(page.getByTestId("order-status")).toContainText(
      "Pedido confirmado!",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("order-total")).toHaveText("0.76542 ETH");
    await expect(page.getByRole("link", { name: /explorador/ })).toHaveAttribute(
      "href",
      /polygonscan\.com\/tx\/0x/,
    );

    // o carrinho foi consumido e o estoque caiu para 4
    await expect(page.getByTestId("cart-count")).toHaveText("0");
    await page.goto("/nfts/1");
    await expect(page.getByTestId("detail-stock")).toHaveText("4");

    await page.goto("/orders");
    await expect(page.getByText("Confirmado")).toBeVisible();
  });

  test("recarregar durante o processamento não cria outro pedido", async ({
    page,
  }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await fillCart(page, "3");
    await page.goto("/checkout");
    await expect(page.getByTestId("quote-total")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page).toHaveURL(/\/order\/ord_/);
    const url = page.url();

    await page.reload();
    await expect(page.getByTestId("order-status")).toBeVisible();
    await expect(page).toHaveURL(url);
    await expect(page.getByTestId("order-status")).toContainText("Pedido confirmado!", {
      timeout: 10_000,
    });

    const token = await page.evaluate(() => localStorage.getItem("nft-marketplace:token"));
    const list = await api(page, "GET", "/orders", { token: token! });
    expect(list.body.total).toBe(1);
  });

  test("pagamento recusado: estado de falha e itens continuam no carrinho", async ({
    page,
  }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    const token = await page.evaluate(() => localStorage.getItem("nft-marketplace:token"));
    const wallet = await api(page, "POST", "/wallets", {
      token: token!,
      body: { address: BLOCKED, network: "Ethereum", label: "Bloqueada" },
    });
    await api(page, "PATCH", `/wallets/${wallet.body.id}`, {
      token: token!,
      body: { isPrimary: true },
    });

    await fillCart(page, "3");
    await page.goto("/checkout");
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page.getByTestId("order-status")).toContainText("Pagamento recusado", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.goto("/nfts/3");
    await expect(page.getByTestId("detail-stock")).toHaveText("10");
  });

  test("conflito de disponibilidade mostra a mensagem do servidor", async ({
    page,
  }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await fillCart(page, "2");
    await page.goto("/cart");
    await page.getByRole("button", { name: /Aumentar quantidade/ }).click();
    await expect(page.getByTestId("qty-2")).toHaveText("2");

    // outro usuário compra uma unidade antes
    const other = await apiLogin(page, CHAVES);
    await api(page, "POST", "/orders", {
      token: other,
      headers: { "Idempotency-Key": "outra-compra" },
      body: { items: [{ nftId: "2", quantity: 1 }], walletId: "w-3" },
    });

    await page.goto("/checkout");
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeDisabled();
  });

  test("cupom inválido mostra o motivo", async ({ page }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await fillCart(page, "1");
    await page.goto("/checkout");
    await page.getByLabel("Código do cupom").fill("VENCIDO");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByText("Cupom vencido.")).toBeVisible();
  });

  test("sem carteira: pede cadastro", async ({ page }) => {
    await boot(page, "/register");
    await page.getByLabel("Nome").fill("Sem Carteira");
    await page.getByLabel("E-mail").fill(`sem.${Date.now()}@exemplo.com`);
    await page.getByLabel("Senha", { exact: true }).fill("Segura@123");
    await page.getByLabel("Confirmar senha").fill("Segura@123");
    await page.getByLabel(/Li e aceito/).check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByTestId("user-name")).toHaveText("Sem Carteira");

    await fillCart(page, "3");
    await page.goto("/checkout");
    await expect(page.getByText("Cadastre uma carteira para pagar")).toBeVisible();
  });

  test("pedido de outro usuário mostra acesso negado", async ({ page }) => {
    await boot(page);
    const a = await apiLogin(page, LARISSA);
    const order = await api(page, "POST", "/orders", {
      token: a,
      headers: { "Idempotency-Key": "iso-ui" },
      body: { items: [{ nftId: "3", quantity: 1 }], walletId: "w-1" },
    });
    await uiLogin(page, CHAVES);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await page.goto(`/order/${order.body.id}`);
    await expect(page.getByText("Acesso negado")).toBeVisible();
  });
});

test.describe("UI · sessão expirada", () => {
  test("expiração no checkout avisa, leva ao login e retoma o contexto", async ({
    page,
  }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await page.goto("/nfts/3");
    await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.goto("/checkout");
    await expect(page.getByTestId("quote-total")).toBeVisible();

    // a sessão cai (revogada) antes de confirmar
    await setScenario(page, { sessionExpired: true });
    await page.getByRole("button", { name: "Confirmar compra" }).click();

    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/);
    await expect(toasts(page).first()).toContainText(
      "Sua sessão expirou",
    );

    await page.getByLabel("E-mail").fill(LARISSA.email);
    await page.getByLabel("Senha").fill(LARISSA.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByTestId("quote-total")).toBeVisible();
    // o carrinho do servidor foi preservado
    await expect(page.getByTestId("cart-count")).toHaveText("1");
  });

  test("falha momentânea é renovada em silêncio, sem deslogar", async ({
    page,
  }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await page.goto("/nfts/3");
    await setScenario(page, { sessionBlip: true });
    await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await expect(page.getByTestId("user-name")).toBeVisible();
    await mocks(page, "getScenario()");
  });
});
