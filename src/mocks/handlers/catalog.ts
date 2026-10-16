import Decimal from "decimal.js";
import { HttpResponse } from "msw";
import { db, publicNft } from "../db";
import { fail, validationError } from "../errors";
import { normalize, parsePositiveInt, route } from "../http";
import type { Ctx } from "../http";
import { COLLECTIONS, NETWORKS, TABS } from "../fixtures/seed";
import type { SeedNft } from "../fixtures/seed";
import { reviewsFor } from "../fixtures/seed";

const SORTS = ["recent", "price_asc", "price_desc", "popular"] as const;
type Sort = (typeof SORTS)[number];

interface Filters {
  q: string;
  collections: string[];
  networks: string[];
  tab: string | null;
  minPrice: Decimal | null;
  maxPrice: Decimal | null;
}

function list(value: string | null) {
  return value
    ? value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
}

function parseFilters(url: URL): Filters | { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const p = url.searchParams;

  const parseMoney = (name: string) => {
    const raw = p.get(name);
    if (raw === null || raw === "") return null;
    try {
      const value = new Decimal(raw);
      if (value.isNegative()) throw new Error("negative");
      return value;
    } catch {
      errors[name] = "Informe um valor decimal válido.";
      return null;
    }
  };

  const minPrice = parseMoney("minPrice");
  const maxPrice = parseMoney("maxPrice");
  if (minPrice && maxPrice && minPrice.gt(maxPrice)) {
    errors.minPrice = "O preço mínimo não pode ser maior que o máximo.";
  }
  const tab = p.get("tab");
  if (tab && tab !== "All" && !TABS.includes(tab)) {
    errors.tab = `Aba inválida. Use: ${TABS.join(", ")}.`;
  }
  const networks = list(p.get("network"));
  if (networks.some((n) => !NETWORKS.includes(n as never))) {
    errors.network = `Rede inválida. Use: ${NETWORKS.join(", ")}.`;
  }
  const collections = list(p.get("collection"));
  if (collections.some((c) => !COLLECTIONS.some((x) => x.id === c))) {
    errors.collection = "Coleção inexistente.";
  }
  if (Object.keys(errors).length) return { errors };
  return {
    q: normalize((p.get("q") ?? "").trim()),
    collections,
    networks,
    tab: tab && tab !== "All" ? tab : null,
    minPrice,
    maxPrice,
  };
}

function matches(
  nft: SeedNft,
  f: Filters,
  skip?: "collection" | "network" | "tab",
) {
  if (f.q) {
    const haystack = normalize(
      `${nft.title} ${nft.description} ${nft.author.name} ${nft.collection.name}`,
    );
    if (!haystack.includes(f.q)) return false;
  }
  if (skip !== "collection" && f.collections.length) {
    if (!f.collections.includes(nft.collection.id)) return false;
  }
  if (skip !== "network" && f.networks.length) {
    if (!f.networks.includes(nft.network)) return false;
  }
  if (skip !== "tab" && f.tab && nft.category !== f.tab) return false;
  const price = new Decimal(nft.priceEth);
  if (f.minPrice && price.lt(f.minPrice)) return false;
  if (f.maxPrice && price.gt(f.maxPrice)) return false;
  return true;
}

function filtersOf(ctx: Ctx) {
  const parsed = parseFilters(ctx.url);
  if ("errors" in parsed) return { error: validationError(parsed.errors) };
  return { filters: parsed };
}

export const catalogHandlers = [
  route(
    "get",
    "/nfts",
    (ctx) => {
      const parsed = parseFilters(ctx.url);
      const p = ctx.url.searchParams;
      const errors: Record<string, string> =
        "errors" in parsed ? { ...parsed.errors } : {};
      const sort = (p.get("sort") ?? "recent") as Sort;
      if (!SORTS.includes(sort)) {
        errors.sort = `Ordenação inválida. Use: ${SORTS.join(", ")}.`;
      }
      const page = parsePositiveInt(p.get("page"), 1);
      if (page === null) errors.page = "Página inválida.";
      const pageSize = parsePositiveInt(p.get("pageSize"), 12, 48);
      if (pageSize === null) errors.pageSize = "Use um valor entre 1 e 48.";
      if (Object.keys(errors).length) return validationError(errors);

      const result = db()
        .nfts.filter((n) => matches(n, parsed as Filters))
        .map((n) => publicNft(n, ctx.user?.id));

      result.sort((a, b) => {
        if (sort === "price_asc")
          return new Decimal(a.priceEth).comparedTo(b.priceEth);
        if (sort === "price_desc")
          return new Decimal(b.priceEth).comparedTo(a.priceEth);
        if (sort === "popular") return b.likes - a.likes;
        return b.createdAt.localeCompare(a.createdAt);
      });

      const total = result.length;
      const size = pageSize!;
      const totalPages = Math.max(Math.ceil(total / size), 1);
      const start = (page! - 1) * size;
      return HttpResponse.json({
        items: result.slice(start, start + size),
        page: page!,
        pageSize: size,
        total,
        totalPages,
      });
    },
    { optionalAuth: true },
  ),

  // Contagens de cada faceta consideram os outros filtros, mas não o da
  // própria dimensão. Cada NFT tem uma coleção e uma rede, então as somas
  // de coleções e de redes coincidem para o mesmo recorte.
  route("get", "/facets", (ctx) => {
    const { filters, error } = filtersOf(ctx);
    if (error) return error;
    const all = db().nfts;

    const collections = COLLECTIONS.map((c) => ({
      id: c.id,
      name: c.name,
      count: all.filter(
        (n) => n.collection.id === c.id && matches(n, filters!, "collection"),
      ).length,
    }));
    const networks = NETWORKS.map((name) => ({
      id: name,
      name,
      count: all.filter(
        (n) => n.network === name && matches(n, filters!, "network"),
      ).length,
    }));
    const tabs = TABS.map((name) => ({
      id: name,
      name,
      count: all.filter((n) => n.category === name && matches(n, filters!, "tab"))
        .length,
    }));
    const byPrice = [...all].sort((a, b) =>
      new Decimal(a.priceEth).comparedTo(b.priceEth),
    );
    const priceRange = {
      min: byPrice[0].priceEth,
      max: byPrice[byPrice.length - 1].priceEth,
    };
    return HttpResponse.json({ collections, networks, tabs, priceRange });
  }),

  route("get", "/collections", () =>
    HttpResponse.json(
      COLLECTIONS.map((c) => ({
        ...c,
        count: db().nfts.filter((n) => n.collection.id === c.id).length,
      })),
    ),
  ),

  route(
    "get",
    "/nfts/:id",
    (ctx) => {
      const nft = db().nfts.find((n) => n.id === ctx.params.id);
      if (!nft) return fail("NOT_FOUND", { message: "NFT não encontrado." });
      return HttpResponse.json(publicNft(nft, ctx.user?.id));
    },
    { optionalAuth: true },
  ),

  route(
    "get",
    "/nfts/:id/related",
    (ctx) => {
      const nft = db().nfts.find((n) => n.id === ctx.params.id);
      if (!nft) return fail("NOT_FOUND", { message: "NFT não encontrado." });
      const related = db()
        .nfts.filter(
          (n) =>
            n.id !== nft.id &&
            (n.collection.id === nft.collection.id ||
              n.category === nft.category),
        )
        .slice(0, 4)
        .map((n) => publicNft(n, ctx.user?.id));
      return HttpResponse.json(related);
    },
    { optionalAuth: true },
  ),

  route("get", "/nfts/:id/reviews", (ctx) => {
    const nft = db().nfts.find((n) => n.id === ctx.params.id);
    if (!nft) return fail("NOT_FOUND", { message: "NFT não encontrado." });
    const page = parsePositiveInt(ctx.url.searchParams.get("page"), 1);
    if (page === null) return validationError({ page: "Página inválida." });
    const all = reviewsFor(nft.id);
    const size = 5;
    return HttpResponse.json({
      items: all.slice((page - 1) * size, page * size),
      page,
      pageSize: size,
      total: all.length,
    });
  }),
];
