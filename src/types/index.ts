export interface NFT {
  id: string;
  title: string;
  description: string;
  image: string;
  priceEth: string; // Valores em ETH como string decimal para precisão
  author: {
    name: string;
    avatar: string;
    verified: boolean;
  };
  category: string;
  availableQuantity: number;
  likes: number;
  isLiked?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  wallets: Wallet[];
}

export interface Wallet {
  id: string;
  address: string;
  network: "Ethereum" | "Polygon" | "Arbitrum";
  isPrimary: boolean;
}

export interface CartItem {
  nft: NFT;
  quantity: number;
}

export interface Order {
  id: string;
  idempotencyKey: string;
  items: CartItem[];
  subtotalEth: string;
  discountEth: string;
  networkFeeEth: string;
  totalEth: string;
  status: "pending" | "confirmed" | "rejected";
  walletAddress: string;
  createdAt: string;
}
