import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NFT, CartItem } from "../types";

interface CartState {
  items: CartItem[];
  addItem: (nft: NFT) => void;
  decrementItem: (nftId: string) => void;
  removeItem: (nftId: string) => void;
  removePurchased: (purchased: { nftId: string; quantity: number }[]) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (nft) =>
        set((state) => {
          const existing = state.items.find((item) => item.nft.id === nft.id);
          if (existing) {
            if (existing.quantity >= nft.availableQuantity) return state;
            return {
              items: state.items.map((item) =>
                item.nft.id === nft.id
                  ? { ...item, quantity: item.quantity + 1 }
                  : item,
              ),
            };
          }
          if (nft.availableQuantity < 1) return state;
          return { items: [...state.items, { nft, quantity: 1 }] };
        }),

      decrementItem: (nftId) =>
        set((state) => ({
          items: state.items
            .map((item) =>
              item.nft.id === nftId
                ? { ...item, quantity: item.quantity - 1 }
                : item,
            )
            .filter((item) => item.quantity > 0),
        })),

      removeItem: (nftId) =>
        set((state) => ({
          items: state.items.filter((item) => item.nft.id !== nftId),
        })),

      // Remove do carrinho só o que foi efetivamente comprado
      removePurchased: (purchased) =>
        set((state) => ({
          items: state.items
            .map((item) => {
              const bought = purchased.find((p) => p.nftId === item.nft.id);
              return bought
                ? { ...item, quantity: item.quantity - bought.quantity }
                : item;
            })
            .filter((item) => item.quantity > 0),
        })),

      clearCart: () => set({ items: [] }),
    }),
    { name: "nft-marketplace:cart" },
  ),
);
