import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useCartStore } from "../services/useCartStore";
import {
  createOrder,
  getAttemptKey,
  setPendingOrderId,
} from "../services/orders";
import type { SessionUser } from "../services/auth";
import { cartSubtotal, formatEth, lineTotal } from "../utils/money";

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: SessionUser | null | undefined;
  onRequireLogin: () => void;
  onOrderCreated: (orderId: string) => void;
}

export default function CartModal({
  isOpen,
  onClose,
  user,
  onRequireLogin,
  onOrderCreated,
}: CartModalProps) {
  const { items, addItem, decrementItem, removeItem, clearCart } =
    useCartStore();

  const mutation = useMutation({
    mutationFn: () => {
      const requestItems = items.map((item) => ({
        nftId: item.nft.id,
        quantity: item.quantity,
      }));
      return createOrder(requestItems, getAttemptKey(requestItems));
    },
    onSuccess: (order) => {
      if (user) setPendingOrderId(user.id, order.id);
      onOrderCreated(order.id);
    },
  });

  if (!isOpen) return null;

  const errorMessage = mutation.isError
    ? (axios.isAxiosError(mutation.error) &&
        mutation.error.response?.data?.error?.message) ||
      "Não foi possível criar o pedido. Tente novamente."
    : null;

  const handleClose = () => {
    mutation.reset();
    onClose();
  };

  const handleCheckout = () => {
    if (!user) {
      handleClose();
      onRequireLogin();
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <h3 id="cart-title" className="text-lg font-bold text-slate-800">
            O seu Carrinho de NFTs
          </h3>
          <button
            onClick={handleClose}
            aria-label="Fechar carrinho"
            className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow divide-y divide-slate-100">
          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-2">🛒</p>
              <p>O seu carrinho está vazio.</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.nft.id}
                className="py-4 flex items-center justify-between gap-4"
              >
                <img
                  src={item.nft.image}
                  alt={item.nft.title}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="flex-grow">
                  <h4 className="font-bold text-slate-800 text-sm">
                    {item.nft.title}
                  </h4>
                  <span className="text-xs text-slate-500">
                    {item.nft.priceEth} ETH cada
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => decrementItem(item.nft.id)}
                      aria-label={`Diminuir quantidade de ${item.nft.title}`}
                      className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-sm font-bold cursor-pointer"
                    >
                      −
                    </button>
                    <span
                      className="text-xs text-slate-700 min-w-4 text-center"
                      aria-live="polite"
                    >
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => addItem(item.nft)}
                      disabled={item.quantity >= item.nft.availableQuantity}
                      aria-label={`Aumentar quantidade de ${item.nft.title}`}
                      className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 block text-sm">
                    {formatEth(lineTotal(item))} ETH
                  </span>
                  <button
                    onClick={() => removeItem(item.nft.id)}
                    className="text-xs text-red-500 hover:text-red-700 mt-1 cursor-pointer font-medium"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="p-6 border-t bg-slate-50">
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-600 font-medium">Subtotal:</span>
              <span className="text-xl font-extrabold text-blue-600">
                {formatEth(cartSubtotal(items))} ETH
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              A taxa de rede e o total final são calculados pela API ao enviar o
              pedido.
            </p>

            {!user && (
              <p className="text-sm text-slate-600 mb-3">
                Entre na sua conta para finalizar a compra.
              </p>
            )}

            {errorMessage && (
              <p
                role="alert"
                className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3"
              >
                {errorMessage}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={clearCart}
                disabled={mutation.isPending}
                className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-xl font-medium transition-colors cursor-pointer text-sm disabled:opacity-50"
              >
                Esvaziar
              </button>
              <button
                onClick={handleCheckout}
                disabled={mutation.isPending}
                className="w-2/3 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium transition-colors cursor-pointer text-sm shadow-sm disabled:opacity-50"
              >
                {mutation.isPending
                  ? "Enviando pedido..."
                  : user
                    ? "Finalizar Compra"
                    : "Entrar para comprar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
