import { expect, test } from "@playwright/test";
import { CHAVES, api, apiLogin, boot, setScenario } from "./helpers";

const WALLET = "0x1111111111111111111111111111111111111111";

test.describe("API · carrinho", () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
  });

  test("adicionar soma quantidades, atualiza e remove", async ({ page }) => {
    const token = await apiLogin(page);
    expect((await api(page, "GET", "/cart", { token })).body.items).toEqual([]);

    const add = await api(page, "POST", "/cart/items", {
      token,
      body: { nftId: "1", quantity: 2 },
    });
    expect(add.status).toBe(201);
    expect(add.body.items[0]).toMatchObject({ id: "1", quantity: 2, lineTotal: "1.7" });
    expect(add.body.subtotal).toBe("1.7");

    const again = await api(page, "POST", "/cart/items", {
      token,
      body: { nftId: "1", quantity: 1 },
    });
    expect(again.body.items[0].quantity).toBe(3);

    const patched = await api(page, "PATCH", "/cart/items/1", {
      token,
      body: { quantity: 1 },
    });
    expect(patched.body.items[0].quantity).toBe(1);
    expect(patched.body.version).toBeGreaterThan(add.body.version);

    expect((await api(page, "DELETE", "/cart/items/1", { token })).status).toBe(204);
    expect((await api(page, "GET", "/cart", { token })).body.items).toEqual([]);
  });

  test("limites: disponibilidade, validação e item inexistente", async ({ page }) => {
    const token = await apiLogin(page);
    const over = await api(page, "POST", "/cart/items", {
      token,
      body: { nftId: "2", quantity: 3 },
    });
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe("AVAILABILITY_CONFLICT");
    expect(over.body.error.details.available).toBe(2);

    expect(
      (await api(page, "POST", "/cart/items", { token, body: { nftId: "1", quantity: 0 } }))
        .status,
    ).toBe(422);
    expect(
      (await api(page, "POST", "/cart/items", { token, body: { nftId: "999", quantity: 1 } }))
        .status,
    ).toBe(404);
    expect(
      (await api(page, "PATCH", "/cart/items/1", { token, body: { quantity: 1 } })).status,
    ).toBe(404);
    await api(page, "POST", "/cart/items", { token, body: { nftId: "1", quantity: 1 } });
    expect(
      (await api(page, "PATCH", "/cart/items/1", { token, body: { quantity: 99 } })).status,
    ).toBe(409);
    expect(
      (await api(page, "PATCH", "/cart/items/1", { token, body: { quantity: 0 } })).status,
    ).toBe(422);
  });

  test("merge respeita disponibilidade e informa ajustes; esvaziar limpa", async ({
    page,
  }) => {
    const token = await apiLogin(page);
    const merged = await api(page, "POST", "/cart/merge", {
      token,
      body: {
        items: [
          { nftId: "2", quantity: 5 }, // só 2 disponíveis
          { nftId: "3", quantity: 1 },
          { nftId: "27", quantity: 1 }, // esgotado: ignorado
          { nftId: "999", quantity: 1 }, // inexistente: ignorado
        ],
      },
    });
    expect(merged.status).toBe(200);
    expect(merged.body.items.map((i: any) => [i.id, i.quantity]).sort()).toEqual([
      ["2", 2],
      ["3", 1],
    ]);
    expect(merged.body.adjusted).toEqual([
      { nftId: "2", requested: 5, applied: 2 },
    ]);

    const bad = await api(page, "POST", "/cart/merge", {
      token,
      body: { items: [{ nftId: 1, quantity: "x" }] },
    });
    expect(bad.status).toBe(422);

    expect((await api(page, "DELETE", "/cart", { token })).status).toBe(204);
    expect((await api(page, "GET", "/cart", { token })).body.items).toEqual([]);
  });

  test("carrinhos são isolados por usuário e saem após confirmação", async ({
    page,
  }) => {
    const a = await apiLogin(page);
    const b = await apiLogin(page, CHAVES);
    await api(page, "POST", "/cart/items", { token: a, body: { nftId: "3", quantity: 2 } });
    expect((await api(page, "GET", "/cart", { token: b })).body.items).toEqual([]);

    const order = await api(page, "POST", "/orders", {
      token: a,
      headers: { "Idempotency-Key": "cart-1" },
      body: { items: [{ nftId: "3", quantity: 1 }], walletId: "w-1" },
    });
    expect(order.status).toBe(201);
    // pendente: o carrinho ainda tem os itens
    expect((await api(page, "GET", "/cart", { token: a })).body.items[0].quantity).toBe(2);

    await expect
      .poll(async () => (await api(page, "GET", "/cart", { token: a })).body.items[0]?.quantity, {
        timeout: 10_000,
      })
      .toBe(1);
  });
});

test.describe("API · favoritos", () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
  });

  test("PUT e DELETE são idempotentes e mantêm likes coerentes", async ({
    page,
  }) => {
    const token = await apiLogin(page);
    const base = (await api(page, "GET", "/nfts/1")).body.likes as number;

    expect((await api(page, "PUT", "/favorites/1", { token })).status).toBe(204);
    expect((await api(page, "PUT", "/favorites/1", { token })).status).toBe(204);
    expect((await api(page, "GET", "/nfts/1")).body.likes).toBe(base + 1);

    const list = await api(page, "GET", "/favorites", { token });
    expect(list.body.map((n: any) => n.id)).toEqual(["1"]);
    expect(list.body[0].isLiked).toBe(true);

    expect((await api(page, "DELETE", "/favorites/1", { token })).status).toBe(204);
    expect((await api(page, "DELETE", "/favorites/1", { token })).status).toBe(204);
    expect((await api(page, "GET", "/nfts/1")).body.likes).toBe(base);
    expect((await api(page, "GET", "/favorites", { token })).body).toEqual([]);

    expect((await api(page, "PUT", "/favorites/999", { token })).status).toBe(404);
  });

  test("favoritos são por usuário; cenário favorites-fail devolve 500", async ({
    page,
  }) => {
    const a = await apiLogin(page);
    const b = await apiLogin(page, CHAVES);
    await api(page, "PUT", "/favorites/2", { token: a });
    expect((await api(page, "GET", "/favorites", { token: b })).body).toEqual([]);

    await setScenario(page, { favoritesFail: true });
    const failed = await api(page, "PUT", "/favorites/3", { token: a });
    expect(failed.status).toBe(500);
    expect(failed.body.error.code).toBe("INTERNAL_ERROR");
    await setScenario(page, { favoritesFail: false });
    expect((await api(page, "PUT", "/favorites/3", { token: a })).status).toBe(204);
  });
});

test.describe("API · perfil e carteiras", () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
  });

  test("perfil: leitura, edição, preferências e avatar", async ({ page }) => {
    const token = await apiLogin(page);
    const me = await api(page, "GET", "/profile", { token });
    expect(me.body.user).toMatchObject({ id: "user-1", name: "Larissa Rosa" });

    const patched = await api(page, "PATCH", "/profile", {
      token,
      body: { name: "  Larissa R.  ", preferences: { newsletter: true } },
    });
    expect(patched.body.user).toMatchObject({
      name: "Larissa R.",
      preferences: { newsletter: true },
    });
    expect((await api(page, "GET", "/auth/session", { token })).body.user.name).toBe(
      "Larissa R.",
    );

    const bad = await api(page, "PATCH", "/profile", { token, body: { name: "x" } });
    expect(bad.status).toBe(422);
    expect(bad.body.error.details.fields.name).toBeTruthy();

    const avatar = await api(page, "PUT", "/profile/avatar", {
      token,
      body: { url: "https://exemplo.com/a.png" },
    });
    expect(avatar.body.user.avatar).toBe("https://exemplo.com/a.png");
    expect(
      (await api(page, "PUT", "/profile/avatar", { token, body: { url: "http://x" } }))
        .status,
    ).toBe(422);
    expect(
      (
        await api(page, "PUT", "/profile/avatar", {
          token,
          body: { url: "data:image/png;base64," + "A".repeat(210 * 1024) },
        })
      ).status,
    ).toBe(422);
  });

  test("carteiras: criar, duplicado, validar, principal única", async ({ page }) => {
    const token = await apiLogin(page);
    const list = await api(page, "GET", "/wallets", { token });
    expect(list.body).toHaveLength(2);
    expect(list.body.filter((w: any) => w.isPrimary)).toHaveLength(1);
    expect(list.body[0].userId).toBeUndefined();

    const created = await api(page, "POST", "/wallets", {
      token,
      body: { address: WALLET, network: "Arbitrum", label: "Nova" },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ network: "Arbitrum", isPrimary: false });

    const dup = await api(page, "POST", "/wallets", {
      token,
      body: { address: WALLET.toUpperCase().replace("0X", "0x"), network: "Arbitrum" },
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("WALLET_DUPLICATED");

    const invalid = await api(page, "POST", "/wallets", {
      token,
      body: { address: "0x123", network: "Solana" },
    });
    expect(invalid.status).toBe(422);
    expect(Object.keys(invalid.body.error.details.fields).sort()).toEqual([
      "address",
      "network",
    ]);

    const promoted = await api(page, "PATCH", `/wallets/${created.body.id}`, {
      token,
      body: { isPrimary: true },
    });
    expect(promoted.body.isPrimary).toBe(true);
    const after = await api(page, "GET", "/wallets", { token });
    expect(after.body.filter((w: any) => w.isPrimary)).toHaveLength(1);
    expect(after.body.find((w: any) => w.id === "w-1").isPrimary).toBe(false);

    const unset = await api(page, "PATCH", `/wallets/${created.body.id}`, {
      token,
      body: { isPrimary: false },
    });
    expect(unset.status).toBe(422);
    expect(unset.body.error.code).toBe("WALLET_PRIMARY_REQUIRED");

    const renamed = await api(page, "PATCH", `/wallets/${created.body.id}`, {
      token,
      body: { label: "Cofre" },
    });
    expect(renamed.body.label).toBe("Cofre");
  });

  test("carteiras: remover promove outra; a última não pode sair; isolamento", async ({
    page,
  }) => {
    const token = await apiLogin(page);
    const other = await apiLogin(page, CHAVES);

    // 'w-1' é a principal: removê-la promove a próxima
    expect((await api(page, "DELETE", "/wallets/w-1", { token })).status).toBe(204);
    const left = await api(page, "GET", "/wallets", { token });
    expect(left.body).toHaveLength(1);
    expect(left.body[0]).toMatchObject({ id: "w-2", isPrimary: true });

    const last = await api(page, "DELETE", "/wallets/w-2", { token });
    expect(last.status).toBe(409);
    expect(last.body.error.code).toBe("LAST_WALLET");

    expect((await api(page, "DELETE", "/wallets/w-3", { token })).status).toBe(403);
    expect(
      (await api(page, "PATCH", "/wallets/w-3", { token, body: { label: "x" } })).status,
    ).toBe(403);
    expect((await api(page, "DELETE", "/wallets/w-zzz", { token })).status).toBe(404);
    expect((await api(page, "GET", "/wallets", { token: other })).body).toHaveLength(1);
  });

  test("primeira carteira de um usuário novo vira principal", async ({ page }) => {
    const reg = await api(page, "POST", "/auth/register", {
      body: { name: "Sem Carteira", email: `sc.${Date.now()}@exemplo.com`, password: "Segura@123" },
    });
    const token = reg.body.token as string;
    expect((await api(page, "GET", "/wallets", { token })).body).toEqual([]);
    const first = await api(page, "POST", "/wallets", {
      token,
      body: { address: WALLET, network: "Ethereum" },
    });
    expect(first.body.isPrimary).toBe(true);
    expect(first.body.label).toBe("Principal");
  });
});

test.describe("API · cenários do mock", () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
  });

  test("server-error e falha intermitente afetam rotas de dados, não a autenticação", async ({
    page,
  }) => {
    await setScenario(page, { serverError: true });
    const down = await api(page, "GET", "/nfts");
    expect(down.status).toBe(500);
    expect(down.body.error.code).toBe("INTERNAL_ERROR");
    expect((await api(page, "POST", "/auth/login", {
      body: { email: "larissa@exemplo.com", password: "Senha@123" },
    })).status).toBe(200);

    await setScenario(page, { serverError: false, failRate: 1 });
    expect((await api(page, "GET", "/nfts")).status).toBe(500);
    await setScenario(page, { failRate: 0 });
    expect((await api(page, "GET", "/nfts")).status).toBe(200);
  });

  test("latência é aplicada", async ({ page }) => {
    await setScenario(page, { latencyMs: 700 });
    const started = Date.now();
    await api(page, "GET", "/nfts/1");
    expect(Date.now() - started).toBeGreaterThanOrEqual(650);
  });

  test("session-expired revoga; session-blip falha uma vez", async ({ page }) => {
    const token = await apiLogin(page);
    await setScenario(page, { sessionBlip: true });
    const blip = await api(page, "GET", "/cart", { token });
    expect(blip.status).toBe(401);
    expect((await api(page, "GET", "/cart", { token })).status).toBe(200);

    await setScenario(page, { sessionExpired: true });
    expect((await api(page, "GET", "/cart", { token })).status).toBe(401);
    expect((await api(page, "GET", "/cart", { token })).status).toBe(401);
    expect((await api(page, "POST", "/auth/refresh", { token })).status).toBe(401);
  });

  test("__reset restaura estoque, usuários e cenário", async ({ page }) => {
    const token = await apiLogin(page);
    await api(page, "POST", "/orders", {
      token,
      headers: { "Idempotency-Key": "reset-1" },
      body: { items: ONE_ITEM, walletId: "w-1" },
    });
    expect((await api(page, "GET", "/nfts/1")).body.availableQuantity).toBe(4);
    await setScenario(page, { latencyMs: 10 });

    expect((await api(page, "POST", "/__reset")).status).toBe(204);
    expect((await api(page, "GET", "/nfts/1")).body.availableQuantity).toBe(5);
    expect((await api(page, "GET", "/__scenario")).body.latencyMs).toBe(0);
    expect((await api(page, "GET", "/auth/session", { token })).status).toBe(401);
  });
});

const ONE_ITEM = [{ nftId: "1", quantity: 1 }];
