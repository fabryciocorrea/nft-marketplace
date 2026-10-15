import { api } from "./api";

export interface OrderItem {
  nftId: string;
  title: string;
  image: string;
  unitPrice: string;
  quantity: number;
}

export interface Order {
  id: string;
  status: "pending" | "confirmed" | "rejected";
  items: OrderItem[];
  subtotal: string;
  discount: string;
  networkFee: string;
  total: string;
  txHash: string;
  createdAt: string;
}

export interface OrderRequestItem {
  nftId: string;
  quantity: number;
}

export async function createOrder(
  items: OrderRequestItem[],
  idempotencyKey: string,
) {
  const { data } = await api.post<Order>(
    "/orders",
    { items },
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return data;
}

export async function fetchOrder(id: string) {
  const { data } = await api.get<Order>(`/orders/${id}`);
  return data;
}

// --- Chave de idempotência: uma por tentativa de compra ---
const ATTEMPT_KEY = "nft-marketplace:checkout-attempt";

function fingerprintOf(items: OrderRequestItem[]) {
  return JSON.stringify(
    [...items].sort((a, b) => a.nftId.localeCompare(b.nftId)),
  );
}

// Reenvios da MESMA compra reutilizam a mesma chave.
// Se o carrinho mudou, uma chave nova é criada.
export function getAttemptKey(items: OrderRequestItem[]) {
  const fingerprint = fingerprintOf(items);
  try {
    const saved = sessionStorage.getItem(ATTEMPT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as { key: string; fingerprint: string };
      if (parsed.fingerprint === fingerprint) return parsed.key;
    }
  } catch {
    // ignora e cria uma chave nova
  }
  const attempt = { key: crypto.randomUUID(), fingerprint };
  sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt));
  return attempt.key;
}

export function clearAttemptKey() {
  sessionStorage.removeItem(ATTEMPT_KEY);
}

// --- Pedido em andamento, por usuário (para recuperar após refresh) ---
const pendingKey = (userId: string) =>
  `nft-marketplace:pending-order:${userId}`;

export const getPendingOrderId = (userId: string) =>
  localStorage.getItem(pendingKey(userId));
export const setPendingOrderId = (userId: string, orderId: string) =>
  localStorage.setItem(pendingKey(userId), orderId);
export const clearPendingOrderId = (userId: string) =>
  localStorage.removeItem(pendingKey(userId));

// --- Garante que os itens comprados saiam do carrinho uma única vez ---
const APPLIED_KEY = "nft-marketplace:applied-orders";

export function markOrderApplied(orderId: string) {
  try {
    const list = JSON.parse(
      localStorage.getItem(APPLIED_KEY) ?? "[]",
    ) as string[];
    if (list.includes(orderId)) return false;
    list.push(orderId);
    localStorage.setItem(APPLIED_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}
