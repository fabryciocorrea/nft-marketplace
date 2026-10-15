import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NFT } from "../types";

// Carrinho ANÔNIMO (visitante). Quando há sessão, o carrinho vive no servidor
// e este store só serve para mesclar no login (POST /cart/merge).
export interface AnonItem {
  nft: NFT;
  quantity: number;
}

interface AnonCartState {
  items: AnonItem[];
  addItem: (nft: NFT) => void;
  decrementItem: (nftId: string) => void;
  removeItem: (nftId: string) => void;
  clear: () => void;
}

export const useAnonCart = create<AnonCartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (nft) =>
        set((state) => {
          const existing = state.items.find((i) => i.nft.id === nft.id);
          if (existing) {
            if (existing.quantity >= nft.availableQuantity) return state;
            return {
              items: state.items.map((i) =>
                i.nft.id === nft.id ? { ...i, quantity: i.quantity + 1 } : i,
              ),
            };
          }
          if (nft.availableQuantity < 1) return state;
          return { items: [...state.items, { nft, quantity: 1 }] };
        }),
      decrementItem: (nftId) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.nft.id === nftId ? { ...i, quantity: i.quantity - 1 } : i,
            )
            .filter((i) => i.quantity > 0),
        })),
      removeItem: (nftId) =>
        set((state) => ({
          items: state.items.filter((i) => i.nft.id !== nftId),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: "nft-marketplace:cart" },
  ),
);
