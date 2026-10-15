// Tipos dos contratos da API (valores monetários sempre em string decimal)

export type Network = "Ethereum" | "Polygon" | "Arbitrum";

export interface NFT {
  id: string;
  title: string;
  description: string;
  image: string;
  priceEth: string;
  author: { name: string; avatar: string; verified: boolean };
  category: string;
  collection: { id: string; name: string };
  network: Network;
  availableQuantity: number;
  likes: number;
  isLiked: boolean;
  version: number;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface FacetOption {
  id: string;
  name: string;
  count: number;
}

export interface Facets {
  collections: FacetOption[];
  networks: FacetOption[];
  tabs: FacetOption[];
  priceRange: { min: string; max: string };
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  preferences: { newsletter: boolean };
}

export interface Wallet {
  id: string;
  address: string;
  network: Network;
  label: string;
  isPrimary: boolean;
}

export interface CartLine {
  id: string;
  nft: NFT;
  quantity: number;
  lineTotal: string;
}

export interface ServerCart {
  items: CartLine[];
  version: number;
  subtotal: string;
}

export interface Quote {
  id: string;
  lines: { nftId: string; title: string; unitPrice: string; quantity: number }[];
  subtotal: string;
  discount: string;
  networkFee: string;
  total: string;
  couponCode: string | null;
  walletId: string;
  network: Network;
  expiresAt: string;
  warnings: { nftId: string; code: string; message: string }[];
}

export interface OrderItem {
  nftId: string;
  title: string;
  image: string;
  unitPrice: string;
  quantity: number;
}

export interface Order {
  id: string;
  status: "pending" | "confirmed" | "failed";
  failureReason: string | null;
  items: OrderItem[];
  subtotal: string;
  discount: string;
  networkFee: string;
  total: string;
  couponCode: string | null;
  walletId: string;
  walletAddress: string;
  network: Network;
  txHash: string;
  version: number;
  createdAt: string;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Post {
  id: string;
  title: string;
  excerpt: string;
  publishedAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { fields?: Record<string, string>; [key: string]: unknown };
  };
}
