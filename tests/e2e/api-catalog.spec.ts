import { expect, test } from "@playwright/test";
import { api, apiLogin, boot } from "./helpers";

test.describe("API · catálogo", () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
  });

  test("paginação: total, páginas e itens por página", async ({ page }) => {
    const p1 = await api(page, "GET", "/nfts?page=1&pageSize=10");
    expect(p1.status).toBe(200);
    expect(p1.body).toMatchObject({ page: 1, pageSize: 10, total: 27, totalPages: 3 });
    expect(p1.body.items).toHaveLength(10);

    const p3 = await api(page, "GET", "/nfts?page=3&pageSize=10");
    expect(p3.body.items).toHaveLength(7);

    const ids = new Set([
      ...p1.body.items.map((n: { id: string }) => n.id),
      ...(await api(page, "GET", "/nfts?page=2&pageSize=10")).body.items.map(
        (n: { id: string }) => n.id,
      ),
      ...p3.body.items.map((n: { id: string }) => n.id),
    ]);
    expect(ids.size).toBe(27); // sem repetição entre páginas
  });

  test("busca ignora acentos e caixa; filtra por título, coleção e criador", async ({
    page,
  }) => {
    const byTitle = await api(page, "GET", "/nfts?q=cyber");
    expect(byTitle.body.items.map((n: { id: string }) => n.id)).toContain("2");
    const byCollection = await api(page, "GET", "/nfts?q=NEO%20TOKYO");
    expect(byCollection.body.total).toBeGreaterThan(3);
    const none = await api(page, "GET", "/nfts?q=zzzzz");
    expect(none.body.total).toBe(0);
    expect(none.body.items).toEqual([]);
  });

  test("filtros: coleção, rede, aba e faixa de preço combinam", async ({
    page,
  }) => {
    const polygon = await api(page, "GET", "/nfts?network=Polygon&pageSize=48");
    expect(
      polygon.body.items.every((n: { network: string }) => n.network === "Polygon"),
    ).toBe(true);

    const combo = await api(
      page,
      "GET",
      "/nfts?tab=Art&collection=cosmic&minPrice=0.5&maxPrice=1&pageSize=48",
    );
    for (const n of combo.body.items) {
      expect(n.category).toBe("Art");
      expect(n.collection.id).toBe("cosmic");
      expect(Number(n.priceEth)).toBeGreaterThanOrEqual(0.5);
      expect(Number(n.priceEth)).toBeLessThanOrEqual(1);
    }
    expect(combo.body.total).toBeGreaterThan(0);

    const multi = await api(page, "GET", "/nfts?collection=cosmic,pixel&pageSize=48");
    const set = new Set(multi.body.items.map((n: any) => n.collection.id));
    expect([...set].sort()).toEqual(["cosmic", "pixel"]);
  });

  test("ordenação por preço (precisão decimal) e curtidas", async ({ page }) => {
    const asc = await api(page, "GET", "/nfts?sort=price_asc&pageSize=48");
    expect(asc.body.items[0].priceEth).toBe("0.000123");
    const prices = asc.body.items.map((n: any) => Number(n.priceEth));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));

    const desc = await api(page, "GET", "/nfts?sort=price_desc&pageSize=48");
    expect(desc.body.items[0].priceEth).toBe("5.00");

    const popular = await api(page, "GET", "/nfts?sort=popular&pageSize=48");
    const likes = popular.body.items.map((n: any) => n.likes);
    expect(likes).toEqual([...likes].sort((a, b) => b - a));
  });

  test("parâmetros inválidos retornam 422 com os campos", async ({ page }) => {
    const r = await api(
      page,
      "GET",
      "/nfts?sort=x&page=0&pageSize=999&minPrice=abc&network=Solana&tab=Nada&collection=x",
    );
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(r.body.error.details.fields).sort()).toEqual(
      ["collection", "minPrice", "network", "page", "pageSize", "sort", "tab"].sort(),
    );

    const range = await api(page, "GET", "/nfts?minPrice=2&maxPrice=1");
    expect(range.status).toBe(422);
  });

  test("facetas: contagens por dimensão e somas consistentes", async ({ page }) => {
    const all = await api(page, "GET", "/facets");
    expect(all.status).toBe(200);
    const sum = (list: { count: number }[]) =>
      list.reduce((t, i) => t + i.count, 0);
    expect(sum(all.body.collections)).toBe(27);
    expect(sum(all.body.networks)).toBe(27); // cada NFT tem 1 coleção e 1 rede
    expect(sum(all.body.tabs)).toBe(27);
    expect(all.body.priceRange).toEqual({ min: "0.000123", max: "5.00" });

    // Com filtro de rede, as coleções refletem o recorte; as redes não se auto-filtram
    const filtered = await api(page, "GET", "/facets?network=Polygon");
    const polygonTotal = (await api(page, "GET", "/nfts?network=Polygon")).body.total;
    expect(sum(filtered.body.collections)).toBe(polygonTotal);
    expect(sum(filtered.body.networks)).toBe(27);
  });

  test("detalhe, relacionados, avaliações e coleções", async ({ page }) => {
    const nft = await api(page, "GET", "/nfts/1");
    expect(nft.status).toBe(200);
    expect(nft.body).toMatchObject({
      id: "1",
      title: "Cosmic Genesis #001",
      priceEth: "0.85",
      availableQuantity: 5,
      isLiked: false,
    });
    expect(typeof nft.body.version).toBe("number");

    const missing = await api(page, "GET", "/nfts/9999");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");

    const related = await api(page, "GET", "/nfts/1/related");
    expect(related.body.length).toBeGreaterThan(0);
    expect(related.body.every((n: any) => n.id !== "1")).toBe(true);

    const reviews = await api(page, "GET", "/nfts/1/reviews");
    expect(reviews.body.items.length).toBeGreaterThan(0);
    expect((await api(page, "GET", "/nfts/1/reviews?page=0")).status).toBe(422);
    expect((await api(page, "GET", "/nfts/9999/reviews")).status).toBe(404);

    const collections = await api(page, "GET", "/collections");
    expect(collections.body).toHaveLength(6);
  });

  test("isLiked só aparece para o usuário autenticado", async ({ page }) => {
    const token = await apiLogin(page);
    await api(page, "PUT", "/favorites/2", { token });
    const logged = await api(page, "GET", "/nfts/2", { token });
    expect(logged.body.isLiked).toBe(true);
    const anon = await api(page, "GET", "/nfts/2");
    expect(anon.body.isLiked).toBe(false);
  });

  test("conteúdo: posts e newsletter idempotente", async ({ page }) => {
    const posts = await api(page, "GET", "/posts");
    expect(posts.body.length).toBeGreaterThan(0);

    const first = await api(page, "POST", "/newsletter", {
      body: { email: "leitor@exemplo.com" },
    });
    const second = await api(page, "POST", "/newsletter", {
      body: { email: "leitor@exemplo.com" },
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const bad = await api(page, "POST", "/newsletter", { body: { email: "x" } });
    expect(bad.status).toBe(422);
  });
});
