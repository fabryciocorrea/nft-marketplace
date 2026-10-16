import { HttpResponse, delay } from "msw";
import {
  CONFIRMATION_DELAY_MS,
  IDEMPOTENCY_TTL_MS,
  QUOTE_TTL_MS,
  bumpNft,
  commit,
  computeTotals,
  couponProblem,
  db,
  findCoupon,
  fingerprintOf,
  publicOrder,
  randomHex,
  scheduleResolution,
  shouldFail,
} from "../db";
import type { DbOrder, DbOrderItem, DbQuote } from "../db";
import { fail, validationError } from "../errors";
import { parsePositiveInt, route } from "../http";
import type { Ctx } from "../http";

interface RequestedItem {
  nftId: string;
  quantity: number;
}

function parseItems(raw: unknown): RequestedItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const items: RequestedItem[] = [];
  for (const entry of raw) {
    if (
      !entry ||
      typeof entry.nftId !== "string" ||
      !Number.isInteger(entry.quantity) ||
      entry.quantity < 1
    ) {
      return null;
    }
    items.push({ nftId: entry.nftId, quantity: entry.quantity });
  }
  // Mesmo NFT em duas linhas: soma as quantidades
  const merged = new Map<string, number>();
  for (const i of items) {
    merged.set(i.nftId, (merged.get(i.nftId) ?? 0) + i.quantity);
  }
  return [...merged].map(([nftId, quantity]) => ({ nftId, quantity }));
}

const ITEMS_ERROR = "Informe ao menos um item com quantidade inteira ≥ 1.";

function explorerUrl(network: string, txHash: string) {
  const host =
    network === "Polygon"
      ? "polygonscan.com"
      : network === "Arbitrum"
        ? "arbiscan.io"
        : "etherscan.io";
  return `https://${host}/tx/${txHash}`;
}

function resolveWallet(ctx: Ctx, walletId: unknown) {
  if (typeof walletId !== "string" || !walletId) {
    return { error: validationError({ walletId: "Selecione uma carteira." }) };
  }
  const wallet = db().wallets.find((w) => w.id === walletId);
  if (!wallet) return { error: fail("NOT_FOUND", { message: "Carteira não encontrada." }) };
  if (wallet.userId !== ctx.user!.id) return { error: fail("FORBIDDEN") };
  return { wallet };
}

export const commerceHandlers = [
  // ------------------------------------------------------------ cotação
  route(
    "post",
    "/quotes",
    async (ctx) => {
      const body = await ctx.body();
      const items = parseItems(body.items);
      if (!items) return validationError({ items: ITEMS_ERROR });

      const { wallet, error } = resolveWallet(ctx, body.walletId);
      if (error) return error;
      if (
        typeof body.network === "string" &&
        body.network !== wallet!.network
      ) {
        return validationError({
          network: `A carteira selecionada opera na rede ${wallet!.network}.`,
        });
      }

      const lines = [];
      const warnings: { nftId: string; code: string; message: string }[] = [];
      for (const item of items) {
        const nft = db().nfts.find((n) => n.id === item.nftId);
        if (!nft) {
          return fail("NOT_FOUND", { message: `NFT ${item.nftId} não encontrado.` });
        }
        if (item.quantity > nft.availableQuantity) {
          warnings.push({
            nftId: nft.id,
            code: nft.availableQuantity === 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
            message: `Disponível: ${nft.availableQuantity} (pedido: ${item.quantity}).`,
          });
        }
        lines.push({
          nftId: nft.id,
          title: nft.title,
          unitPrice: nft.priceEth,
          quantity: item.quantity,
        });
      }

      let couponCode: string | null = null;
      let coupon = null;
      if (typeof body.couponCode === "string" && body.couponCode.trim()) {
        coupon = findCoupon(body.couponCode);
        const problem = couponProblem(coupon);
        if (problem) {
          return fail("COUPON_INVALID", {
            message: problem,
            details: { fields: { couponCode: problem } },
          });
        }
        couponCode = coupon!.code;
      }

      const totals = computeTotals(lines, wallet!.network, coupon);
      const quote: DbQuote = {
        id: `qt_${randomHex(6)}`,
        userId: ctx.user!.id,
        fingerprint: fingerprintOf(items, {
          couponCode,
          walletId: wallet!.id,
        }),
        ...totals,
        couponCode,
        walletId: wallet!.id,
        network: wallet!.network,
        expiresAt: Date.now() + QUOTE_TTL_MS,
      };
      const d = db();
      d.quotes = d.quotes.filter((q) => q.expiresAt > Date.now() - 600_000);
      d.quotes.push(quote);
      commit();

      return HttpResponse.json({
        id: quote.id,
        lines,
        ...totals,
        couponCode,
        walletId: wallet!.id,
        network: wallet!.network,
        expiresAt: new Date(quote.expiresAt).toISOString(),
        warnings,
      });
    },
    { auth: true },
  ),

  // ------------------------------------------------------------ pedidos
  route(
    "post",
    "/orders",
    async (ctx) => {
      const key = ctx.request.headers.get("Idempotency-Key");
      if (!key) return fail("IDEMPOTENCY_KEY_REQUIRED");

      const body = await ctx.body();
      const items = parseItems(body.items);
      if (!items) return validationError({ items: ITEMS_ERROR });
      const { wallet, error } = resolveWallet(ctx, body.walletId);
      if (error) return error;

      const quoteId = typeof body.quoteId === "string" ? body.quoteId : null;
      const quote = quoteId
        ? (db().quotes.find((q) => q.id === quoteId) ?? null)
        : null;
      let couponCode =
        typeof body.couponCode === "string" && body.couponCode.trim()
          ? body.couponCode.trim().toUpperCase()
          : null;
      if (quote && !couponCode) couponCode = quote.couponCode;

      const fingerprint = fingerprintOf(items, {
        couponCode,
        walletId: wallet!.id,
      });

      await delay(300);

      // Idempotência: escopada por usuário, com validade de 24 h
      const scoped = `${ctx.user!.id}:${key}`;
      const known = db().idempotency[scoped];
      if (known && Date.now() - known.at < IDEMPOTENCY_TTL_MS) {
        if (known.fingerprint !== fingerprint) {
          return fail("IDEMPOTENCY_KEY_REUSED");
        }
        const existing = db().orders.find((o) => o.id === known.orderId);
        if (existing) return HttpResponse.json(publicOrder(existing));
      }

      if (quoteId) {
        if (!quote || quote.userId !== ctx.user!.id) {
          return fail("NOT_FOUND", { message: "Cotação não encontrada." });
        }
        if (quote.expiresAt < Date.now()) return fail("QUOTE_EXPIRED");
        if (quote.fingerprint !== fingerprint) return fail("QUOTE_MISMATCH");
      }

      // Preço e disponibilidade vêm do servidor, nunca do cliente
      const orderItems: DbOrderItem[] = [];
      for (const item of items) {
        const nft = db().nfts.find((n) => n.id === item.nftId);
        if (!nft) {
          return fail("NOT_FOUND", { message: `NFT ${item.nftId} não encontrado.` });
        }
        if (item.quantity > nft.availableQuantity) {
          return fail("AVAILABILITY_CONFLICT", {
            message: `Quantidade indisponível para "${nft.title}" (máximo ${nft.availableQuantity}).`,
            details: {
              nftId: nft.id,
              available: nft.availableQuantity,
              requested: item.quantity,
            },
          });
        }
        orderItems.push({
          nftId: nft.id,
          title: nft.title,
          image: nft.image,
          unitPrice: nft.priceEth,
          quantity: item.quantity,
        });
      }

      let coupon = null;
      if (couponCode) {
        coupon = findCoupon(couponCode);
        const problem = couponProblem(coupon);
        if (problem) {
          return fail("COUPON_INVALID", {
            message: problem,
            details: { fields: { couponCode: problem } },
          });
        }
      }

      const totals = computeTotals(orderItems, wallet!.network, coupon);
      if (quote && quote.total !== totals.total) {
        return fail("QUOTE_MISMATCH", {
          message: "Os valores mudaram desde a cotação. Gere outra.",
        });
      }

      // Reserva de estoque e registro da chave na mesma operação síncrona
      const d = db();
      for (const item of orderItems) {
        const nft = d.nfts.find((n) => n.id === item.nftId)!;
        nft.availableQuantity -= item.quantity;
        bumpNft(nft.id);
      }
      if (coupon) d.couponUses[coupon.code] = (d.couponUses[coupon.code] ?? 0) + 1;

      const now = Date.now();
      const order: DbOrder = {
        id: `ord_${randomHex(4)}`,
        userId: ctx.user!.id,
        items: orderItems,
        ...totals,
        couponCode: coupon?.code ?? null,
        walletId: wallet!.id,
        walletAddress: wallet!.address,
        network: wallet!.network,
        txHash: `0x${randomHex(32)}`,
        status: "pending",
        failureReason: null,
        willFail: shouldFail(wallet!.address),
        version: 1,
        createdAt: now,
        resolveAt: now + CONFIRMATION_DELAY_MS,
      };
      d.orders.push(order);
      d.idempotency[scoped] = { orderId: order.id, fingerprint, at: now };
      commit();
      scheduleResolution(order);

      return HttpResponse.json(publicOrder(order), { status: 201 });
    },
    { auth: true },
  ),

  route(
    "get",
    "/orders",
    (ctx) => {
      const p = ctx.url.searchParams;
      const errors: Record<string, string> = {};
      const page = parsePositiveInt(p.get("page"), 1);
      if (page === null) errors.page = "Página inválida.";
      const pageSize = parsePositiveInt(p.get("pageSize"), 10, 50);
      if (pageSize === null) errors.pageSize = "Use um valor entre 1 e 50.";
      const status = p.get("status");
      if (status && !["pending", "confirmed", "failed"].includes(status)) {
        errors.status = "Status inválido.";
      }
      if (Object.keys(errors).length) return validationError(errors);

      const mine = db()
        .orders.filter(
          (o) => o.userId === ctx.user!.id && (!status || o.status === status),
        )
        .sort((a, b) => b.createdAt - a.createdAt);
      const size = pageSize!;
      return HttpResponse.json({
        items: mine.slice((page! - 1) * size, page! * size).map(publicOrder),
        page: page!,
        pageSize: size,
        total: mine.length,
        totalPages: Math.max(Math.ceil(mine.length / size), 1),
      });
    },
    { auth: true },
  ),

  route(
    "get",
    "/orders/:id",
    (ctx) => {
      const order = db().orders.find((o) => o.id === ctx.params.id);
      if (!order) return fail("NOT_FOUND", { message: "Pedido não encontrado." });
      if (order.userId !== ctx.user!.id) {
        return fail("FORBIDDEN", {
          message: "Você não tem acesso a este pedido.",
        });
      }
      return HttpResponse.json(publicOrder(order));
    },
    { auth: true },
  ),

  route(
    "get",
    "/orders/:id/receipt",
    (ctx) => {
      const order = db().orders.find((o) => o.id === ctx.params.id);
      if (!order) return fail("NOT_FOUND", { message: "Pedido não encontrado." });
      if (order.userId !== ctx.user!.id) return fail("FORBIDDEN");
      return HttpResponse.json({
        order: publicOrder(order),
        explorerUrl:
          order.status === "confirmed"
            ? explorerUrl(order.network, order.txHash)
            : null,
      });
    },
    { auth: true },
  ),
];
