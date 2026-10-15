import { setupWorker } from "msw/browser";
import { http, HttpResponse, delay } from "msw";
import Decimal from "decimal.js";
import { initialNfts, mockUsers } from "./fixtures/db";
import { getOrder, getOrderByKey, saveOrder } from "./ordersStore";
import type { StoredOrder, StoredOrderItem } from "./ordersStore";

const SESSION_TTL_MS = 30 * 60 * 1000; // sessão de 30 minutos
const CONFIRMATION_DELAY_MS = 2500; // tempo até o pedido ser confirmado
const NETWORK_FEE = "0.0021"; // taxa de rede fixa (ETH)

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function publicUser(user: (typeof mockUsers)[number]) {
  return { id: user.id, name: user.name, email: user.email };
}

// Token do mock: "mock.<userId>.<expiraEm>"
function createToken(userId: string) {
  return `mock.${userId}.${Date.now() + SESSION_TTL_MS}`;
}

function getUserFromRequest(request: Request) {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.replace("Bearer ", "");
  const [prefix, userId, expiresAt] = token.split(".");
  if (prefix !== "mock" || !userId || Number(expiresAt) < Date.now())
    return null;
  return mockUsers.find((u) => u.id === userId) ?? null;
}

function errorResponse(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status });
}

function randomHex(bytes: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// O status é derivado do tempo: começa "pending" e vira "confirmed"
function toPublicOrder(order: StoredOrder) {
  const confirmed = Date.now() - order.createdAt >= CONFIRMATION_DELAY_MS;
  return {
    id: order.id,
    status: confirmed ? "confirmed" : "pending",
    items: order.items,
    subtotal: order.subtotal,
    discount: order.discount,
    networkFee: order.networkFee,
    total: order.total,
    txHash: order.txHash,
    createdAt: new Date(order.createdAt).toISOString(),
  };
}

export const handlers = [
  http.get("/api/nfts", () => HttpResponse.json(initialNfts)),

  http.post("/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    if (!body.email || !body.password) {
      return errorResponse(422, "VALIDATION_ERROR", "Informe e-mail e senha.");
    }

    const user = mockUsers.find(
      (u) => u.email.toLowerCase() === body.email!.toLowerCase(),
    );
    const passwordHash = await sha256(body.password);

    if (!user || user.passwordHash !== passwordHash) {
      return errorResponse(
        401,
        "INVALID_CREDENTIALS",
        "E-mail ou senha inválidos.",
      );
    }

    return HttpResponse.json({
      token: createToken(user.id),
      user: publicUser(user),
    });
  }),

  http.get("/api/auth/session", ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user) {
      return errorResponse(
        401,
        "SESSION_INVALID",
        "Sessão inválida ou expirada.",
      );
    }
    return HttpResponse.json(publicUser(user));
  }),

  http.post("/api/auth/logout", () => new HttpResponse(null, { status: 204 })),

  http.post("/api/orders", async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user) {
      return errorResponse(
        401,
        "SESSION_INVALID",
        "Sessão inválida ou expirada.",
      );
    }

    const key = request.headers.get("Idempotency-Key");
    if (!key) {
      return errorResponse(
        422,
        "IDEMPOTENCY_KEY_REQUIRED",
        "O cabeçalho Idempotency-Key é obrigatório.",
      );
    }

    const body = (await request.json()) as {
      items?: { nftId: string; quantity: number }[];
    };
    const requested = body.items ?? [];

    if (
      requested.length === 0 ||
      requested.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)
    ) {
      return errorResponse(
        422,
        "VALIDATION_ERROR",
        "Pedido sem itens ou com quantidade inválida.",
      );
    }

    // "Impressão digital" do conteúdo: mesma chave + mesmo conteúdo = mesmo pedido
    const fingerprint = JSON.stringify(
      requested
        .map((i) => ({ nftId: i.nftId, quantity: i.quantity }))
        .sort((a, b) => a.nftId.localeCompare(b.nftId)),
    );

    await delay(600);

    const existing = getOrderByKey(user.id, key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        return errorResponse(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "Esta chave de idempotência já foi usada com outro conteúdo.",
        );
      }
      return HttpResponse.json(toPublicOrder(existing.order), { status: 200 });
    }

    // Preço e disponibilidade vêm do servidor, nunca do cliente
    const items: StoredOrderItem[] = [];
    for (const r of requested) {
      const nft = initialNfts.find((n) => n.id === r.nftId);
      if (!nft) {
        return errorResponse(
          404,
          "NOT_FOUND",
          `NFT ${r.nftId} não encontrado.`,
        );
      }
      if (r.quantity > nft.availableQuantity) {
        return errorResponse(
          409,
          "AVAILABILITY_CONFLICT",
          `Quantidade indisponível para "${nft.title}" (máximo ${nft.availableQuantity}).`,
        );
      }
      items.push({
        nftId: nft.id,
        title: nft.title,
        image: nft.image,
        unitPrice: nft.priceEth,
        quantity: r.quantity,
      });
    }

    const subtotal = items.reduce(
      (sum, item) => sum.plus(new Decimal(item.unitPrice).times(item.quantity)),
      new Decimal(0),
    );
    const discount = new Decimal(0);
    const networkFee = new Decimal(NETWORK_FEE);
    const total = subtotal.minus(discount).plus(networkFee);

    const order: StoredOrder = {
      id: `ord_${randomHex(4)}`,
      userId: user.id,
      items,
      subtotal: subtotal.toFixed(),
      discount: discount.toFixed(),
      networkFee: networkFee.toFixed(),
      total: total.toFixed(),
      txHash: `0x${randomHex(32)}`, // referência de transação simulada
      createdAt: Date.now(),
    };

    saveOrder(order, key, fingerprint);
    return HttpResponse.json(toPublicOrder(order), { status: 201 });
  }),

  http.get("/api/orders/:id", ({ request, params }) => {
    const user = getUserFromRequest(request);
    if (!user) {
      return errorResponse(
        401,
        "SESSION_INVALID",
        "Sessão inválida ou expirada.",
      );
    }

    const order = getOrder(String(params.id));
    if (!order) {
      return errorResponse(404, "NOT_FOUND", "Pedido não encontrado.");
    }
    if (order.userId !== user.id) {
      return errorResponse(
        403,
        "FORBIDDEN",
        "Você não tem acesso a este pedido.",
      );
    }

    return HttpResponse.json(toPublicOrder(order));
  }),
];

export const worker = setupWorker(...handlers);
