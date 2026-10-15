import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { BLOCKED, CHAVES, api, apiLogin, boot, mocks } from "./helpers";

const ONE = [{ nftId: "1", quantity: 1 }];

async function waitFor(page: Page, token: string, orderId: string, status: string) {
  await expect
    .poll(
      async () => (await api(page, "GET", `/orders/${orderId}`, { token })).body.status,
      { timeout: 10_000 },
    )
    .toBe(status);
}

test.describe("API · cotação", () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
  });

  test("totais com precisão decimal, rede e validade", async ({ page }) => {
    const token = await apiLogin(page);
    const q = await api(page, "POST", "/quotes", {
      token,
      body: { items: ONE, walletId: "w-1" },
    });
    expect(q.status).toBe(200);
    expect(q.body).toMatchObject({
      subtotal: "0.85",
      discount: "0",
      networkFee: "0.0021",
      total: "0.8521",
      network: "Ethereum",
      warnings: [],
    });
    expect(Date.parse(q.body.expiresAt)).toBeGreaterThan(Date.now());

    // duas unidades: taxa cresce; rede Polygon: taxa menor
    const two = await api(page, "POST", "/quotes", {
      token,
      body: { items: [{ nftId: "1", quantity: 2 }], walletId: "w-1" },
    });
    expect(two.body).toMatchObject({
      subtotal: "1.7",
      networkFee: "0.0025",
      total: "1.7025",
    });
    const poly = await api(page, "POST", "/quotes", {
      token,
      body: { items: ONE, walletId: "w-2" },
    });
    expect(poly.body).toMatchObject({
      networkFee: "0.00042",
      total: "0.85042",
      network: "Polygon",
    });
  });

  test("cupons: percentual, taxa zero, vencido e inexistente", async ({ page }) => {
    const token = await apiLogin(page);
    const promo = await api(page, "POST", "/quotes", {
      token,
      body: { items: ONE, walletId: "w-1", couponCode: "promo10" },
    });
    expect(promo.body).toMatchObject({
      discount: "0.085",
      total: "0.7671",
      couponCode: "PROMO10",
    });

    const free = await api(page, "POST", "/quotes", {
      token,
      body: { items: ONE, walletId: "w-1", couponCode: "FRETE0" },
    });
    expect(free.body).toMatchObject({ networkFee: "0", total: "0.85" });

    for (const code of ["VENCIDO", "NAOEXISTE"]) {
      const bad = await api(page, "POST", "/quotes", {
        token,
        body: { items: ONE, walletId: "w-1", couponCode: code },
      });
      expect(bad.status, code).toBe(422);
      expect(bad.body.error.code).toBe("COUPON_INVALID");
    }
  });

  test("avisos de disponibilidade e validações", async ({ page }) => {
    const token = await apiLogin(page);
    const warn = await api(page, "POST", "/quotes", {
      token,
      body: {
        items: [
          { nftId: "27", quantity: 1 },
          { nftId: "2", quantity: 3 },
        ],
        walletId: "w-1",
      },
    });
    expect(warn.status).toBe(200);
    expect(warn.body.warnings.map((w: any) => w.code).sort()).toEqual([
      "LOW_STOCK",
      "OUT_OF_STOCK",
    ]);

    const noItems = await api(page, "POST", "/quotes", {
      token,
      body: { items: [], walletId: "w-1" },
    });
    expect(noItems.status).toBe(422);
    const noWallet = await api(page, "POST", "/quotes", {
      token,
      body: { items: ONE },
    });
    expect(noWallet.status).toBe(422);
    expect(noWallet.body.error.details.fields.walletId).toBeTruthy();
    const wrongNetwork = await api(page, "POST", "/quotes", {
      token,
      body: { items: ONE, walletId: "w-1", network: "Polygon" },
    });
    expect(wrongNetwork.status).toBe(422);
    const unknownNft = await api(page, "POST", "/quotes", {
      token,
      body: { items: [{ nftId: "999", quantity: 1 }], walletId: "w-1" },
    });
    expect(unknownNft.status).toBe(404);
  });

  test("carteira de outro usuário é 403; inexistente é 404", async ({ page }) => {
    const token = await apiLogin(page);
    const other = await api(page, "POST", "/quotes", {
      token,
      body: { items: ONE, walletId: "w-3" },
    });
    expect(other.status).toBe(403);
    const missing = await api(page, "POST", "/quotes", {
      token,
      body: { items: ONE, walletId: "w-zzz" },
    });
    expect(missing.status).toBe(404);
  });
});

test.describe("API · pedidos", () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
  });

  test("exige Idempotency-Key e valida o corpo", async ({ page }) => {
    const token = await apiLogin(page);
    const noKey = await api(page, "POST", "/orders", {
      token,
      body: { items: ONE, walletId: "w-1" },
    });
    expect(noKey.status).toBe(422);
    expect(noKey.body.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");

    const bad = await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "k-bad" },
      body: { items: [{ nftId: "1", quantity: 0 }], walletId: "w-1" },
    });
    expect(bad.status).toBe(422);

    const noWallet = await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "k-nw" },
      body: { items: ONE },
    });
    expect(noWallet.status).toBe(422);

    const foreign = await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "k-fw" },
      body: { items: ONE, walletId: "w-3" },
    });
    expect(foreign.status).toBe(403);
  });

  test("idempotência: mesma chave repete o pedido; conteúdo diferente é 409", async ({
    page,
  }) => {
    const token = await apiLogin(page);
    const headers = { "Idempotency-Key": "chave-1" };
    const body = { items: ONE, walletId: "w-1" };

    const first = await api(page, "POST", "/orders", { token, headers, body });
    const second = await api(page, "POST", "/orders", { token, headers, body });
    const third = await api(page, "POST", "/orders", {
      token,
      headers,
      body: { items: [{ nftId: "1", quantity: 2 }], walletId: "w-1" },
    });
    const otherWallet = await api(page, "POST", "/orders", {
      token,
      headers,
      body: { items: ONE, walletId: "w-2" },
    });

    expect(first.status).toBe(201);
    expect(first.body.status).toBe("pending");
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(otherWallet.status).toBe(409);

    // a repetição não debitou o estoque duas vezes
    const nft = await api(page, "GET", "/nfts/1");
    expect(nft.body.availableQuantity).toBe(4);
  });

  test("chaves repetidas simultâneas criam um único pedido", async ({ page }) => {
    const token = await apiLogin(page);
    const results = await page.evaluate(async (t) => {
      const send = () =>
        fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${t}`,
            "Idempotency-Key": "corrida-1",
          },
          body: JSON.stringify({
            items: [{ nftId: "3", quantity: 1 }],
            walletId: "w-1",
          }),
        }).then((r) => r.json());
      return Promise.all([send(), send(), send()]);
    }, token);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    const nft = await api(page, "GET", "/nfts/3");
    expect(nft.body.availableQuantity).toBe(9);
  });

  test("a mesma chave de outro usuário é independente", async ({ page }) => {
    const a = await apiLogin(page);
    const b = await apiLogin(page, CHAVES);
    const headers = { "Idempotency-Key": "mesma-chave" };
    const ra = await api(page, "POST", "/orders", {
      token: a,
      headers,
      body: { items: ONE, walletId: "w-1" },
    });
    const rb = await api(page, "POST", "/orders", {
      token: b,
      headers,
      body: { items: ONE, walletId: "w-3" },
    });
    expect(ra.status).toBe(201);
    expect(rb.status).toBe(201);
    expect(ra.body.id).not.toBe(rb.body.id);
  });

  test("estoque: debita na criação e 409 quando excede a disponibilidade", async ({
    page,
  }) => {
    const token = await apiLogin(page);
    const ok = await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "estoque-1" },
      body: { items: [{ nftId: "2", quantity: 2 }], walletId: "w-1" },
    });
    expect(ok.status).toBe(201);
    expect((await api(page, "GET", "/nfts/2")).body.availableQuantity).toBe(0);

    const conflict = await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "estoque-2" },
      body: { items: [{ nftId: "2", quantity: 1 }], walletId: "w-1" },
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("AVAILABILITY_CONFLICT");
    expect(conflict.body.error.details).toMatchObject({
      nftId: "2",
      available: 0,
      requested: 1,
    });

    const soldOut = await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "estoque-3" },
      body: { items: [{ nftId: "27", quantity: 1 }], walletId: "w-1" },
    });
    expect(soldOut.status).toBe(409);
  });

  test("pendente vira confirmado; recibo traz o explorador por rede", async ({
    page,
  }) => {
    const token = await apiLogin(page);
    const created = await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "conf-1" },
      body: { items: ONE, walletId: "w-2" }, // Polygon
    });
    const id = created.body.id;
    expect(created.body).toMatchObject({
      walletId: "w-2",
      network: "Polygon",
      subtotal: "0.85",
      networkFee: "0.00042",
      total: "0.85042",
    });
    expect(created.body.txHash).toMatch(/^0x[0-9a-f]{64}$/);

    const early = await api(page, "GET", `/orders/${id}/receipt`, { token });
    expect(early.body.explorerUrl).toBeNull();

    await waitFor(page, token, id, "confirmed");
    const receipt = await api(page, "GET", `/orders/${id}/receipt`, { token });
    expect(receipt.body.explorerUrl).toMatch(
      /^https:\/\/polygonscan\.com\/tx\/0x/,
    );
  });

  test("pagamento recusado devolve o estoque e marca failed", async ({ page }) => {
    const token = await apiLogin(page);
    const wallet = await api(page, "POST", "/wallets", {
      token,
      body: { address: BLOCKED, network: "Ethereum", label: "Bloqueada" },
    });
    expect(wallet.status).toBe(201);

    const created = await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "falha-1" },
      body: { items: [{ nftId: "1", quantity: 2 }], walletId: wallet.body.id },
    });
    expect(created.status).toBe(201);
    expect((await api(page, "GET", "/nfts/1")).body.availableQuantity).toBe(3);

    await waitFor(page, token, created.body.id, "failed");
    const failed = await api(page, "GET", `/orders/${created.body.id}`, { token });
    expect(failed.body.failureReason).toBe("PAYMENT_FAILED");
    expect((await api(page, "GET", "/nfts/1")).body.availableQuantity).toBe(5);
  });

  test("cotação: usar quoteId, expirada e divergente", async ({ page }) => {
    const token = await apiLogin(page);
    const quote = await api(page, "POST", "/quotes", {
      token,
      body: { items: ONE, walletId: "w-1", couponCode: "PROMO10" },
    });

    const mismatch = await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "q-mis" },
      body: {
        items: [{ nftId: "1", quantity: 2 }],
        walletId: "w-1",
        couponCode: "PROMO10",
        quoteId: quote.body.id,
      },
    });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.error.code).toBe("QUOTE_MISMATCH");

    const ok = await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "q-ok" },
      body: { items: ONE, walletId: "w-1", quoteId: quote.body.id },
    });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({
      discount: "0.085",
      total: "0.7671",
      couponCode: "PROMO10",
    });

    await mocks(page, "expireQuotes()");
    const expired = await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "q-exp" },
      body: { items: ONE, walletId: "w-1", quoteId: quote.body.id },
    });
    expect(expired.status).toBe(409);
    expect(expired.body.error.code).toBe("QUOTE_EXPIRED");

    const other = await apiLogin(page, CHAVES);
    const stolen = await api(page, "POST", "/orders", {
      token: other,
      headers: { "Idempotency-Key": "q-stolen" },
      body: { items: ONE, walletId: "w-3", quoteId: quote.body.id },
    });
    expect(stolen.status).toBe(404);
  });

  test("cupom de uso único é consumido pelo pedido", async ({ page }) => {
    const token = await apiLogin(page);
    const first = await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "unico-1" },
      body: { items: ONE, walletId: "w-1", couponCode: "UNICO" },
    });
    expect(first.status).toBe(201);
    expect(first.body.discount).toBe("0.17");

    const quote = await api(page, "POST", "/quotes", {
      token,
      body: { items: ONE, walletId: "w-1", couponCode: "UNICO" },
    });
    expect(quote.status).toBe(422);
    expect(quote.body.error.code).toBe("COUPON_INVALID");
  });

  test("isolamento: pedido alheio é 403, histórico só mostra o próprio", async ({
    page,
  }) => {
    const larissa = await apiLogin(page);
    const chaves = await apiLogin(page, CHAVES);

    const mine = await api(page, "POST", "/orders", {
      token: larissa,
      headers: { "Idempotency-Key": "iso-1" },
      body: { items: ONE, walletId: "w-1" },
    });
    const theirs = await api(page, "POST", "/orders", {
      token: chaves,
      headers: { "Idempotency-Key": "iso-2" },
      body: { items: [{ nftId: "3", quantity: 1 }], walletId: "w-3" },
    });

    const peek = await api(page, "GET", `/orders/${mine.body.id}`, {
      token: chaves,
    });
    expect(peek.status).toBe(403);
    expect(peek.body.error.code).toBe("FORBIDDEN");
    expect(
      (await api(page, "GET", `/orders/${mine.body.id}/receipt`, { token: chaves }))
        .status,
    ).toBe(403);
    expect(
      (await api(page, "GET", "/orders/ord_naoexiste", { token: larissa })).status,
    ).toBe(404);

    const list = await api(page, "GET", "/orders", { token: larissa });
    const ids = list.body.items.map((o: any) => o.id);
    expect(ids).toContain(mine.body.id);
    expect(ids).not.toContain(theirs.body.id);
  });

  test("histórico: paginação, filtro por status e validação", async ({ page }) => {
    const token = await apiLogin(page);
    for (let i = 0; i < 3; i++) {
      const r = await api(page, "POST", "/orders", {
        token,
        headers: { "Idempotency-Key": `hist-${i}` },
        body: { items: [{ nftId: "3", quantity: 1 }], walletId: "w-1" },
      });
      expect(r.status).toBe(201);
    }
    const p1 = await api(page, "GET", "/orders?pageSize=2&page=1", { token });
    expect(p1.body).toMatchObject({ total: 3, totalPages: 2, pageSize: 2 });
    expect(p1.body.items).toHaveLength(2);
    const p2 = await api(page, "GET", "/orders?pageSize=2&page=2", { token });
    expect(p2.body.items).toHaveLength(1);

    const times = p1.body.items.map((o: any) => Date.parse(o.createdAt));
    expect(times[0]).toBeGreaterThanOrEqual(times[1]);

    const confirmed = await api(page, "GET", "/orders?status=confirmed", { token });
    expect(confirmed.body.items.every((o: any) => o.status === "confirmed")).toBe(true);
    expect((await api(page, "GET", "/orders?status=x", { token })).status).toBe(422);
    expect((await api(page, "GET", "/orders?page=0", { token })).status).toBe(422);
  });
});
