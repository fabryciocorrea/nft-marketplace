export interface StoredOrderItem {
  nftId: string;
  title: string;
  image: string;
  unitPrice: string;
  quantity: number;
}

export interface StoredOrder {
  id: string;
  userId: string;
  items: StoredOrderItem[];
  subtotal: string;
  discount: string;
  networkFee: string;
  total: string;
  txHash: string;
  createdAt: number;
}

interface Store {
  orders: Record<string, StoredOrder>;
  keys: Record<string, { orderId: string; fingerprint: string }>;
}

const STORAGE_KEY = "nft-marketplace:mock-orders";

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // dados corrompidos: começa do zero
  }
  return { orders: {}, keys: {} };
}

function save(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // sem espaço ou storage indisponível
  }
}

export function getOrder(id: string) {
  return load().orders[id] ?? null;
}

export function getOrderByKey(userId: string, key: string) {
  const store = load();
  const record = store.keys[`${userId}:${key}`];
  if (!record) return null;
  const order = store.orders[record.orderId];
  return order ? { order, fingerprint: record.fingerprint } : null;
}

export function saveOrder(
  order: StoredOrder,
  key: string,
  fingerprint: string,
) {
  const store = load();
  store.orders[order.id] = order;
  store.keys[`${order.userId}:${key}`] = { orderId: order.id, fingerprint };
  save(store);
}
