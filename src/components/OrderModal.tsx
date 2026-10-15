import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  clearAttemptKey,
  clearPendingOrderId,
  fetchOrder,
  markOrderApplied,
} from "../services/orders";
import { useCartStore } from "../services/useCartStore";
import { formatEth } from "../utils/money";

interface OrderModalProps {
  orderId: string | null;
  userId: string;
  onClose: () => void;
}

export default function OrderModal({
  orderId,
  userId,
  onClose,
}: OrderModalProps) {
  const removePurchased = useCartStore((state) => state.removePurchased);

  const {
    data: order,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["orders", userId, orderId],
    queryFn: () => fetchOrder(orderId!),
    enabled: !!orderId,
    // Enquanto estiver pendente, consulta de novo a cada segundo
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 1000 : false,
  });

  // Depois de confirmado, remove do carrinho só o que foi comprado (uma única vez)
  useEffect(() => {
    if (order?.status === "confirmed" && markOrderApplied(order.id)) {
      removePurchased(
        order.items.map((item) => ({
          nftId: item.nftId,
          quantity: item.quantity,
        })),
      );
    }
  }, [order, removePurchased]);

  if (!orderId) return null;

  const isPending = !order || order.status === "pending";
  const canClose = isError || (!!order && order.status !== "pending");

  const handleClose = () => {
    clearPendingOrderId(userId);
    clearAttemptKey();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b bg-slate-50">
          <h3 id="order-title" className="text-lg font-bold text-slate-800">
            Seu pedido
          </h3>
        </div>

        <div className="p-6 overflow-y-auto" role="status" aria-live="polite">
          {isError && (
            <p className="text-red-600">
              Não foi possível carregar o pedido. Tente novamente.
            </p>
          )}

          {!isError && (isLoading || isPending) && (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">⏳</p>
              <p className="font-medium text-slate-700">
                Processando o seu pedido...
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Aguarde a confirmação. Não feche esta página.
              </p>
            </div>
          )}

          {order && order.status === "confirmed" && (
            <div>
              <div className="text-center mb-4">
                <p className="text-3xl mb-1">✅</p>
                <p className="font-bold text-slate-800 text-lg">
                  Pedido confirmado!
                </p>
                <p className="text-xs text-slate-400">Pedido {order.id}</p>
              </div>

              <ul className="divide-y divide-slate-100 mb-4">
                {order.items.map((item) => (
                  <li key={item.nftId} className="py-3 flex items-center gap-3">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-grow">
                      <p className="text-sm font-semibold text-slate-800">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.unitPrice} ETH × {item.quantity}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <dl className="text-sm space-y-1">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd>{formatEth(order.subtotal)} ETH</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Desconto</dt>
                  <dd>{formatEth(order.discount)} ETH</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Taxa de rede</dt>
                  <dd>{formatEth(order.networkFee)} ETH</dd>
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t">
                  <dt>Total</dt>
                  <dd className="text-blue-600">
                    {formatEth(order.total)} ETH
                  </dd>
                </div>
              </dl>

              <p className="text-xs text-slate-400 mt-4 break-all">
                Transação (simulada): {order.txHash}
              </p>
            </div>
          )}

          {order && order.status === "rejected" && (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">❌</p>
              <p className="font-bold text-slate-800">Pedido recusado</p>
              <p className="text-sm text-slate-500 mt-1">
                Seus itens continuam no carrinho.
              </p>
            </div>
          )}
        </div>

        {canClose && (
          <div className="p-6 border-t bg-slate-50">
            <button
              onClick={handleClose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium transition-colors cursor-pointer text-sm"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
