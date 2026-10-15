import Decimal from "decimal.js";
import { publish } from "./bus";
import {
  BLOCKED_ADDRESS,
  COUPONS,
  SEED_NFTS,
  SEED_USERS,
  SEED_WALLETS,
} from "./fixtures/seed";
import type { Coupon, Network, SeedNft, SeedUser } from "./fixtures/seed";
import { getScenario } from "./scenarios";

// ---------------------------------------------------------------- tipos

export interface DbUser extends SeedUser {
  avatar: string | null;
  preferences: { newsletter: boolean };
  createdAt: string;
}

export interface DbSession {
  token: string;
  userId: string;
  expiresAt: number;
  revoked: boolean;
}

export interface DbWallet {
  id: string;
  userId: string;
  address: string;
  network: Network;
  label: string;
  isPrimary: boolean;
}

export interface DbOrderItem {
  nftId: string;
  title: string;
  image: string;
  unitPrice: string;
  quantity: number;
}

export interface DbOrder {
  id: string;
  userId: string;
  items: DbOrderItem[];
  subtotal: string;
  discount: string;
  networkFee: string;
  total: string;
  couponCode: string | null;
  walletId: string;
  walletAddress: string;
  network: Network;
  txHash: string;
  status: "pending" | "confirmed" | "failed";
  failureReason: string | null;
  willFail: boolean;
  version: number;
  createdAt: number;
  resolveAt: number;
}

export interface DbQuote {
  id: string;
  userId: string;
  fingerprint: string;
  subtotal: string;
  discount: string;
  networkFee: string;
  total: string;
  couponCode: string | null;
  walletId: string;
  network: Network;
  expiresAt: number;
}

export interface Db {
  schemaVersion: number;
  users: DbUser[];
  sessions: DbSession[];
  nfts: SeedNft[];
  nftVersions: Record<string, number>;
  favorites: Record<string, string[]>; // userId -> nftIds
  carts: Record<
    string,
    { items: { nftId: string; quantity: number }[]; version: number }
  >;
  wallets: DbWallet[];
  orders: DbOrder[];
  idempotency: Record<
    string,
    { orderId: string; fingerprint: string; at: number }
  >;
  quotes: DbQuote[];
  couponUses: Record<string, number>;
  newsletter: string[];
  loginFailures: Record<string, number[]>; // e-mail -> timestamps
}

// ---------------------------------------------------------------- constantes

export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = "kurio:mock-db";
export const SESSION_TTL_MS = 30 * 60 * 1000;
export const CONFIRMATION_DELAY_MS = 2500;
export const QUOTE_TTL_MS = 60 * 1000;
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
export const LOGIN_WINDOW_MS = 5 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;
export const NETWORK_MULTIPLIER: Record<Network, string> = {
  Ethereum: "1",
  Polygon: "0.2",
  Arbitrum: "0.4",
};
const BASE_NETWORK_FEE = "0.0021";
const FEE_PER_EXTRA_UNIT = "0.0004";

// ---------------------------------------------------------------- persistência

function seed(): Db {
  return {
    schemaVersion: SCHEMA_VERSION,
    users: SEED_USERS.map((u) => ({
      ...u,
      avatar: null,
      preferences: { newsletter: false },
      createdAt: "2026-09-01T12:00:00.000Z",
    })),
    sessions: [],
    nfts: SEED_NFTS.map((n) => ({ ...n })),
    nftVersions: {},
    favorites: {},
    carts: {},
    wallets: SEED_WALLETS.map((w) => ({ ...w })),
    orders: [],
    idempotency: {},
    quotes: [],
    couponUses: {},
    newsletter: [],
    loginFailures: {},
  };
}

let cache: Db | null = null;

function load(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      if (parsed.schemaVersion === SCHEMA_VERSION) return parsed;
    }
  } catch {
    // dados corrompidos ou versão antiga: recomeça do seed
  }
  return seed();
}

export function db(): Db {
  if (!cache) cache = load();
  return cache;
}

// Outra aba pode ter alterado o banco: relê antes de cada requisição.
export function refresh() {
  cache = load();
}

export function commit() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db()));
  } catch {
    // sem espaço ou storage indisponível: segue em memória
  }
}

export function resetDb() {
  cache = seed();
  commit();
}

// ---------------------------------------------------------------- utilitários

export function randomHex(bytes: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const hashPassword = (salt: string, password: string) =>
  sha256(salt + password);

// ---------------------------------------------------------------- NFTs

export function nftVersion(id: string) {
  return db().nftVersions[id] ?? 1;
}

export function likesOf(nftId: string) {
  const base = db().nfts.find((n) => n.id === nftId)?.likes ?? 0;
  const extra = Object.values(db().favorites).filter((f) =>
    f.includes(nftId),
  ).length;
  return base + extra;
}

export function publicNft(nft: SeedNft, userId?: string | null) {
  return {
    ...nft,
    likes: likesOf(nft.id),
    isLiked: userId ? (db().favorites[userId] ?? []).includes(nft.id) : false,
    version: nftVersion(nft.id),
  };
}

export function bumpNft(nftId: string) {
  const d = db();
  d.nftVersions[nftId] = nftVersion(nftId) + 1;
  const nft = d.nfts.find((n) => n.id === nftId);
  if (nft) {
    publish({
      name: "nft.updated",
      resource: "nft",
      id: nftId,
      version: d.nftVersions[nftId],
      payload: {
        availableQuantity: nft.availableQuantity,
        priceEth: nft.priceEth,
        likes: likesOf(nftId),
      },
    });
  }
}

// ---------------------------------------------------------------- precificação

export function findCoupon(code: string | null | undefined): Coupon | null {
  if (!code) return null;
  return COUPONS.find((c) => c.code === code.trim().toUpperCase()) ?? null;
}

export function couponProblem(coupon: Coupon | null, now = Date.now()) {
  if (!coupon) return "Cupom inexistente.";
  if (coupon.expiresAt && Date.parse(coupon.expiresAt) < now)
    return "Cupom vencido.";
  if (
    coupon.maxUses !== undefined &&
    (db().couponUses[coupon.code] ?? 0) >= coupon.maxUses
  )
    return "Cupom esgotado.";
  return null;
}

export interface Totals {
  subtotal: string;
  discount: string;
  networkFee: string;
  total: string;
}

// Função única usada por cotação e pedido: o servidor é a fonte do total.
export function computeTotals(
  lines: { unitPrice: string; quantity: number }[],
  network: Network,
  coupon: Coupon | null,
): Totals {
  const subtotal = lines.reduce(
    (sum, l) => sum.plus(new Decimal(l.unitPrice).times(l.quantity)),
    new Decimal(0),
  );
  const units = lines.reduce((sum, l) => sum + l.quantity, 0);
  let fee = new Decimal(BASE_NETWORK_FEE)
    .plus(new Decimal(FEE_PER_EXTRA_UNIT).times(Math.max(units - 1, 0)))
    .times(NETWORK_MULTIPLIER[network]);
  let discount = new Decimal(0);
  if (coupon?.kind === "percent") {
    discount = subtotal.times(coupon.value ?? "0").div(100);
  } else if (coupon?.kind === "zero_fee") {
    fee = new Decimal(0);
  }
  const total = subtotal.minus(discount).plus(fee);
  return {
    subtotal: subtotal.toFixed(),
    discount: discount.toFixed(),
    networkFee: fee.toFixed(),
    total: total.toFixed(),
  };
}

export function fingerprintOf(
  items: { nftId: string; quantity: number }[],
  extra: Record<string, unknown> = {},
) {
  return JSON.stringify({
    items: items
      .map((i) => ({ nftId: i.nftId, quantity: i.quantity }))
      .sort((a, b) => a.nftId.localeCompare(b.nftId)),
    ...extra,
  });
}

// ---------------------------------------------------------------- pedidos

export function publicOrder(order: DbOrder) {
  return {
    id: order.id,
    status: order.status,
    failureReason: order.failureReason,
    items: order.items,
    subtotal: order.subtotal,
    discount: order.discount,
    networkFee: order.networkFee,
    total: order.total,
    couponCode: order.couponCode,
    walletId: order.walletId,
    walletAddress: order.walletAddress,
    network: order.network,
    txHash: order.txHash,
    version: order.version,
    createdAt: new Date(order.createdAt).toISOString(),
  };
}

// Resolve (pending -> confirmed | failed) os pedidos cujo prazo venceu.
// Chamado em leituras e por timers; é idempotente.
export function resolveOrders(now = Date.now()) {
  const d = db();
  let changed = false;
  for (const order of d.orders) {
    if (order.status !== "pending" || order.resolveAt > now) continue;
    order.version += 1;
    if (order.willFail) {
      order.status = "failed";
      order.failureReason = "PAYMENT_FAILED";
      for (const item of order.items) {
        const nft = d.nfts.find((n) => n.id === item.nftId);
        if (nft) {
          nft.availableQuantity += item.quantity; // devolve a reserva
          bumpNft(nft.id);
        }
      }
    } else {
      order.status = "confirmed";
      // Só agora o que foi comprado sai do carrinho do servidor
      const cart = d.carts[order.userId];
      if (cart) {
        cart.items = cart.items
          .map((line) => {
            const bought = order.items.find((i) => i.nftId === line.nftId);
            return bought
              ? { ...line, quantity: line.quantity - bought.quantity }
              : line;
          })
          .filter((line) => line.quantity > 0);
        cart.version += 1;
      }
    }
    publish({
      name: "order.updated",
      resource: "order",
      id: order.id,
      version: order.version,
      ownerId: order.userId,
      payload: publicOrder(order),
    });
    changed = true;
  }
  if (changed) commit();
}

export function scheduleResolution(order: DbOrder) {
  const wait = Math.max(order.resolveAt - Date.now(), 0) + 20;
  setTimeout(() => resolveOrders(), wait);
}

// Reagenda pedidos pendentes depois de um refresh da página
export function resumePendingOrders() {
  for (const order of db().orders) {
    if (order.status === "pending") scheduleResolution(order);
  }
}

export function shouldFail(walletAddress: string) {
  return (
    getScenario().rejectOrders ||
    walletAddress.toLowerCase() === BLOCKED_ADDRESS.toLowerCase()
  );
}
