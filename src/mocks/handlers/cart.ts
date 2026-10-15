import Decimal from "decimal.js";
import { HttpResponse } from "msw";
import { commit, db, publicNft } from "../db";
import { fail, validationError } from "../errors";
import { route } from "../http";

function cartOf(userId: string) {
  return (db().carts[userId] ??= { items: [], version: 1 });
}

function serialize(userId: string) {
  const cart = cartOf(userId);
  const items = cart.items
    .map((line) => {
      const nft = db().nfts.find((n) => n.id === line.nftId);
      if (!nft) return null;
      return {
        id: line.nftId,
        nft: publicNft(nft, userId),
        quantity: line.quantity,
        lineTotal: new Decimal(nft.priceEth).times(line.quantity).toFixed(),
      };
    })
    .filter((i): i is NonNullable<typeof i> => i !== null);
  const subtotal = items.reduce(
    (sum, i) => sum.plus(i.lineTotal),
    new Decimal(0),
  );
  return { items, version: cart.version, subtotal: subtotal.toFixed() };
}

function touch(userId: string) {
  cartOf(userId).version += 1;
  commit();
}

function isQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

export const cartHandlers = [
  route("get", "/cart", (ctx) => HttpResponse.json(serialize(ctx.user!.id)), {
    auth: true,
  }),

  // Soma a quantidade informada à linha existente
  route(
    "post",
    "/cart/items",
    async (ctx) => {
      const body = await ctx.body();
      if (typeof body.nftId !== "string" || !isQuantity(body.quantity)) {
        return validationError({
          quantity: "Informe nftId e uma quantidade inteira maior que zero.",
        });
      }
      const nft = db().nfts.find((n) => n.id === body.nftId);
      if (!nft) return fail("NOT_FOUND", { message: "NFT não encontrado." });

      const cart = cartOf(ctx.user!.id);
      const line = cart.items.find((i) => i.nftId === nft.id);
      const requested = (line?.quantity ?? 0) + body.quantity;
      if (requested > nft.availableQuantity) {
        return fail("AVAILABILITY_CONFLICT", {
          message: `Quantidade indisponível para "${nft.title}" (máximo ${nft.availableQuantity}).`,
          details: { nftId: nft.id, available: nft.availableQuantity, requested },
        });
      }
      if (line) line.quantity = requested;
      else cart.items.push({ nftId: nft.id, quantity: requested });
      touch(ctx.user!.id);
      return HttpResponse.json(serialize(ctx.user!.id), { status: 201 });
    },
    { auth: true },
  ),

  // Define a quantidade da linha (o id da linha é o id do NFT)
  route(
    "patch",
    "/cart/items/:id",
    async (ctx) => {
      const body = await ctx.body();
      if (!isQuantity(body.quantity)) {
        return validationError({
          quantity: "Use DELETE para remover; a quantidade deve ser ≥ 1.",
        });
      }
      const cart = cartOf(ctx.user!.id);
      const line = cart.items.find((i) => i.nftId === ctx.params.id);
      if (!line) return fail("NOT_FOUND", { message: "Item não está no carrinho." });
      const nft = db().nfts.find((n) => n.id === line.nftId);
      if (nft && body.quantity > nft.availableQuantity) {
        return fail("AVAILABILITY_CONFLICT", {
          message: `Quantidade indisponível para "${nft.title}" (máximo ${nft.availableQuantity}).`,
          details: {
            nftId: nft.id,
            available: nft.availableQuantity,
            requested: body.quantity,
          },
        });
      }
      line.quantity = body.quantity;
      touch(ctx.user!.id);
      return HttpResponse.json(serialize(ctx.user!.id));
    },
    { auth: true },
  ),

  route(
    "delete",
    "/cart/items/:id",
    (ctx) => {
      const cart = cartOf(ctx.user!.id);
      cart.items = cart.items.filter((i) => i.nftId !== ctx.params.id);
      touch(ctx.user!.id);
      return new HttpResponse(null, { status: 204 });
    },
    { auth: true },
  ),

  route(
    "delete",
    "/cart",
    (ctx) => {
      cartOf(ctx.user!.id).items = [];
      touch(ctx.user!.id);
      return new HttpResponse(null, { status: 204 });
    },
    { auth: true },
  ),

  // Mescla o carrinho anônimo no login, respeitando a disponibilidade
  route(
    "post",
    "/cart/merge",
    async (ctx) => {
      const body = await ctx.body();
      const incoming = Array.isArray(body.items) ? body.items : [];
      if (
        incoming.some(
          (i) =>
            !i ||
            typeof i.nftId !== "string" ||
            !isQuantity(i.quantity),
        )
      ) {
        return validationError({ items: "Itens inválidos." });
      }
      const cart = cartOf(ctx.user!.id);
      const adjusted: { nftId: string; requested: number; applied: number }[] =
        [];
      for (const item of incoming as { nftId: string; quantity: number }[]) {
        const nft = db().nfts.find((n) => n.id === item.nftId);
        if (!nft) continue;
        const line = cart.items.find((i) => i.nftId === item.nftId);
        const wanted = (line?.quantity ?? 0) + item.quantity;
        const applied = Math.min(wanted, nft.availableQuantity);
        if (applied < 1) continue;
        if (applied < wanted) {
          adjusted.push({ nftId: item.nftId, requested: wanted, applied });
        }
        if (line) line.quantity = applied;
        else cart.items.push({ nftId: item.nftId, quantity: applied });
      }
      touch(ctx.user!.id);
      return HttpResponse.json({ ...serialize(ctx.user!.id), adjusted });
    },
    { auth: true },
  ),
];
