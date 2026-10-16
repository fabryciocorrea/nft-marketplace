import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  LARISSA,
  api,
  apiLogin,
  boot,
  logout,
  mocks,
  uiLogin,
} from "./helpers";

async function stats(page: Page) {
  const text = await page.getByTestId("realtime-stats").textContent();
  const m = /eventos (\d+) descartados (\d+)/.exec(text ?? "")!;
  return { events: Number(m[1]), discarded: Number(m[2]) };
}

test.describe("UI · tempo real (Socket.IO simulado)", () => {
  test("conecta e informa o estado da conexão", async ({ page }) => {
    await boot(page);
    await expect(page.getByTestId("realtime-status")).toContainText("conectado");
    await expect.poll(() => mocks<number>(page, "socket.count()")).toBe(1);
  });

  test("nft.updated atualiza o estoque na tela sem recarregar", async ({ page }) => {
    await boot(page, "/nfts/3");
    await expect(page.getByTestId("detail-stock")).toHaveText("10");
    await expect(page.getByTestId("realtime-status")).toContainText("conectado");

    const token = await apiLogin(page, LARISSA);
    await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "rt-1" },
      body: { items: [{ nftId: "3", quantity: 2 }], walletId: "w-1" },
    });
    // nenhuma navegação ou refetch manual: o valor vem do evento
    await expect(page.getByTestId("detail-stock")).toHaveText("8");
    expect((await stats(page)).events).toBeGreaterThan(0);
  });

  test("evento duplicado e evento antigo são descartados", async ({ page }) => {
    await boot(page, "/nfts/3");
    await expect(page.getByTestId("realtime-status")).toContainText("conectado");
    const token = await apiLogin(page, LARISSA);
    await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "rt-2" },
      body: { items: [{ nftId: "3", quantity: 1 }], walletId: "w-1" },
    });
    await expect(page.getByTestId("detail-stock")).toHaveText("9");
    const before = await stats(page);

    await mocks(page, "socket.replayLast()"); // mesmo eventId
    await expect.poll(async () => (await stats(page)).discarded).toBe(before.discarded + 1);
    await mocks(page, "socket.emitStale()"); // versão menor
    await expect.poll(async () => (await stats(page)).discarded).toBe(before.discarded + 2);

    expect((await stats(page)).events).toBe(before.events); // nada foi aplicado
    await expect(page.getByTestId("detail-stock")).toHaveText("9");
  });

  test("queda da conexão: reconecta e reconcilia o estado via REST", async ({
    page,
  }) => {
    await boot(page, "/nfts/3");
    await expect(page.getByTestId("detail-stock")).toHaveText("10");
    await expect(page.getByTestId("realtime-status")).toContainText("conectado");

    await mocks(page, "socket.dropAll()");
    await expect(page.getByTestId("realtime-status")).toContainText("desconectado");

    // reconectou sozinho
    await expect(page.getByTestId("realtime-status")).toContainText("conectado", {
      timeout: 10_000,
    });
    await expect.poll(() => mocks<number>(page, "socket.count()")).toBe(1);
  });

  test("mudança durante a queda é recuperada na reconexão", async ({ page }) => {
    await boot(page, "/nfts/3");
    await expect(page.getByTestId("detail-stock")).toHaveText("10");
    await expect(page.getByTestId("realtime-status")).toContainText("conectado");
    const token = await apiLogin(page, LARISSA);

    // derruba e muda o estoque enquanto o cliente está fora do ar
    await page.evaluate(() => {
      const m = (window as any).__kurioMocks;
      m.socket.dropAll();
    });
    await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "rt-3" },
      body: { items: [{ nftId: "3", quantity: 3 }], walletId: "w-1" },
    });
    await expect(page.getByTestId("realtime-status")).toContainText("conectado", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("detail-stock")).toHaveText("7");
  });

  test("confirmação do pedido chega por evento (sem depender do polling)", async ({
    page,
  }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await page.goto("/nfts/3");
    await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
    await page.goto("/checkout");
    await expect(page.getByTestId("quote-total")).toBeVisible();
    await expect(page.getByTestId("realtime-status")).toContainText("conectado");
    await page.getByRole("button", { name: "Confirmar compra" }).click();

    await expect(page.getByTestId("order-status")).toContainText("Pedido confirmado!", {
      timeout: 10_000,
    });
    // o polling de contingência só roda a cada 5 s com o socket conectado:
    // se a tela mudou antes disso, o evento foi o responsável
    expect((await stats(page)).events).toBeGreaterThan(0);
  });

  test("logout encerra a conexão do usuário e cria uma anônima", async ({ page }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await expect(page.getByTestId("realtime-status")).toContainText("conectado");
    await logout(page);
    await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
    await expect(page.getByTestId("realtime-status")).toContainText("conectado");
    await expect.poll(() => mocks<number>(page, "socket.count()")).toBe(1);
  });
});
