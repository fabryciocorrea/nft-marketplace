import { api, clearToken, setToken } from "./api";
import type {
  Facets,
  NFT,
  Order,
  Page,
  Post,
  Quote,
  Review,
  ServerCart,
  User,
  Wallet,
} from "../types";

// ------------------------------------------------------------------ auth
interface AuthResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<AuthResponse>("/auth/login", {
    email,
    password,
  });
  setToken(data.token);
  return data.user;
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
}) {
  const { data } = await api.post<AuthResponse>("/auth/register", input);
  setToken(data.token);
  return data.user;
}

export async function socialLogin(provider: "google" | "github", code: string) {
  const { data } = await api.post<AuthResponse>(`/auth/social/${provider}`, {
    code,
  });
  setToken(data.token);
  return data.user;
}

export async function fetchSession() {
  const { data } = await api.get<{ user: User }>("/auth/session");
  return data.user;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    clearToken();
  }
}

export const forgotPassword = (email: string) =>
  api.post("/auth/forgot-password", { email });

// ------------------------------------------------------------------ catálogo
export interface CatalogParams {
  q?: string;
  collection?: string;
  network?: string;
  minPrice?: string;
  maxPrice?: string;
  tab?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

const clean = (params: CatalogParams) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ""),
  );

export async function fetchNfts(params: CatalogParams, signal?: AbortSignal) {
  const { data } = await api.get<Page<NFT>>("/nfts", {
    params: clean(params),
    signal,
  });
  return data;
}

export async function fetchFacets(params: CatalogParams, signal?: AbortSignal) {
  const filters = { ...params };
  delete filters.page;
  delete filters.pageSize;
  delete filters.sort;
  const { data } = await api.get<Facets>("/facets", {
    params: clean(filters),
    signal,
  });
  return data;
}

export async function fetchNft(id: string, signal?: AbortSignal) {
  const { data } = await api.get<NFT>(`/nfts/${id}`, { signal });
  return data;
}

export async function fetchRelated(id: string) {
  const { data } = await api.get<NFT[]>(`/nfts/${id}/related`);
  return data;
}

export async function fetchReviews(id: string) {
  const { data } = await api.get<Page<Review>>(`/nfts/${id}/reviews`);
  return data;
}

// ------------------------------------------------------------------ favoritos
export async function fetchFavorites() {
  const { data } = await api.get<NFT[]>("/favorites");
  return data;
}

export async function setFavorite(nftId: string, liked: boolean) {
  if (liked) await api.put(`/favorites/${nftId}`);
  else await api.delete(`/favorites/${nftId}`);
}

// ------------------------------------------------------------------ carrinho
export async function fetchCart() {
  const { data } = await api.get<ServerCart>("/cart");
  return data;
}

export async function addCartItem(nftId: string, quantity = 1) {
  const { data } = await api.post<ServerCart>("/cart/items", {
    nftId,
    quantity,
  });
  return data;
}

export async function setCartItemQuantity(nftId: string, quantity: number) {
  const { data } = await api.patch<ServerCart>(`/cart/items/${nftId}`, {
    quantity,
  });
  return data;
}

export const removeCartItem = (nftId: string) =>
  api.delete(`/cart/items/${nftId}`);

export const clearServerCart = () => api.delete("/cart");

export async function mergeCart(items: { nftId: string; quantity: number }[]) {
  const { data } = await api.post<ServerCart>("/cart/merge", { items });
  return data;
}

// ------------------------------------------------------------------ cotação e pedidos
export interface QuoteInput {
  items: { nftId: string; quantity: number }[];
  walletId: string;
  couponCode?: string;
}

export async function createQuote(input: QuoteInput) {
  const { data } = await api.post<Quote>("/quotes", input);
  return data;
}

export async function createOrder(
  input: QuoteInput & { quoteId?: string },
  idempotencyKey: string,
) {
  const { data } = await api.post<Order>("/orders", input, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return data;
}

export async function fetchOrder(id: string) {
  const { data } = await api.get<Order>(`/orders/${id}`);
  return data;
}

export async function fetchOrders(page = 1) {
  const { data } = await api.get<Page<Order>>("/orders", {
    params: { page, pageSize: 10 },
  });
  return data;
}

export async function fetchReceipt(id: string) {
  const { data } = await api.get<{ order: Order; explorerUrl: string | null }>(
    `/orders/${id}/receipt`,
  );
  return data;
}

// ------------------------------------------------------------------ perfil e carteiras
export async function updateProfile(input: {
  name?: string;
  preferences?: { newsletter: boolean };
}) {
  const { data } = await api.patch<{ user: User }>("/profile", input);
  return data.user;
}

export async function updateAvatar(url: string) {
  const { data } = await api.put<{ user: User }>("/profile/avatar", { url });
  return data.user;
}

export const changePassword = (input: {
  currentPassword: string;
  newPassword: string;
}) => api.post("/profile/password", input);

export async function fetchWallets() {
  const { data } = await api.get<Wallet[]>("/wallets");
  return data;
}

export async function addWallet(input: {
  address: string;
  network: string;
  label?: string;
}) {
  const { data } = await api.post<Wallet>("/wallets", input);
  return data;
}

export async function updateWallet(
  id: string,
  input: { label?: string; isPrimary?: boolean },
) {
  const { data } = await api.patch<Wallet>(`/wallets/${id}`, input);
  return data;
}

export const deleteWallet = (id: string) => api.delete(`/wallets/${id}`);

// ------------------------------------------------------------------ conteúdo
export async function fetchPosts() {
  const { data } = await api.get<Post[]>("/posts");
  return data;
}

export const subscribeNewsletter = (email: string) =>
  api.post("/newsletter", { email });
