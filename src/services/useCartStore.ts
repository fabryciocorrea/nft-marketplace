import { create } from "zustand";
import type { NFT, CartItem } from "../types";

interface CartState {
  items: CartItem[];
  addItem: (nft: NFT) => void;
  removeItem: (nftId: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  addItem: (nft) =>
    set((state) => {
      const existingItem = state.items.find((item) => item.nft.id === nft.id);
      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.nft.id === nft.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          ),
        };
      }
      return { items: [...state.items, { nft, quantity: 1 }] };
    }),
  removeItem: (nftId) =>
    set((state) => ({
      items: state.items.filter((item) => item.nft.id !== nftId),
    })),
  clearCart: () => set({ items: [] }),
}));
