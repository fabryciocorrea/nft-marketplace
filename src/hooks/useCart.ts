import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import {
  addCartItem,
  clearServerCart,
  fetchCart,
  removeCartItem,
  setCartItemQuantity,
} from "../services/endpoints";
import { parseError } from "../services/api";
import { toast } from "../services/toast";
import { useAnonCart } from "../services/useCartStore";
import { lineTotal } from "../utils/money";
import type { NFT, ServerCart } from "../types";
import { useSession } from "./useSession";

export interface CartRow {
  nft: NFT;
  quantity: number;
  lineTotal: string;
}

// Visitante: carrinho local persistido. Logado: carrinho no servidor.
export function useCart() {
  const queryClient = useQueryClient();
  const { data: user } = useSession();
  const anon = useAnonCart();
  const key = ["cart", user?.id] as const;

  const serverCart = useQuery({
    queryKey: key,
    queryFn: fetchCart,
    enabled: !!user,
  });

  const apply = (cart: ServerCart) => queryClient.setQueryData(key, cart);
  const onError = (error: unknown) => toast.error(parseError(error).message);

  const add = useMutation({
    mutationFn: (nft: NFT) => addCartItem(nft.id, 1),
    onSuccess: apply,
    onError,
  });
  const setQty = useMutation({
    mutationFn: (v: { nftId: string; quantity: number }) =>
      v.quantity < 1
        ? removeCartItem(v.nftId).then(() => fetchCart())
        : setCartItemQuantity(v.nftId, v.quantity),
    onSuccess: apply,
    onError,
  });
  const remove = useMutation({
    mutationFn: (nftId: string) =>
      removeCartItem(nftId).then(() => fetchCart()),
    onSuccess: apply,
    onError,
  });
  const clearAll = useMutation({
    mutationFn: () => clearServerCart().then(() => fetchCart()),
    onSuccess: apply,
    onError,
  });

  const rows: CartRow[] = user
    ? (serverCart.data?.items ?? []).map((i) => ({
        nft: i.nft,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      }))
    : anon.items.map((i) => ({
        nft: i.nft,
        quantity: i.quantity,
        lineTotal: lineTotal(i.nft.priceEth, i.quantity).toFixed(),
      }));

  const subtotal = rows.reduce(
    (t, r) => t.plus(r.lineTotal),
    new Decimal(0),
  );
  const count = rows.reduce((t, r) => t + r.quantity, 0);

  return {
    rows,
    subtotal,
    count,
    isLoading: !!user && serverCart.isLoading,
    isBusy:
      add.isPending ||
      setQty.isPending ||
      remove.isPending ||
      clearAll.isPending,
    quantityOf: (nftId: string) =>
      rows.find((r) => r.nft.id === nftId)?.quantity ?? 0,
    add: (nft: NFT) => (user ? add.mutate(nft) : anon.addItem(nft)),
    decrement: (nft: NFT, current: number) =>
      user
        ? setQty.mutate({ nftId: nft.id, quantity: current - 1 })
        : anon.decrementItem(nft.id),
    remove: (nft: NFT) =>
      user ? remove.mutate(nft.id) : anon.removeItem(nft.id),
    clear: () => (user ? clearAll.mutate() : anon.clear()),
  };
}
