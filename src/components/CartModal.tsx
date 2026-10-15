import { useCartStore } from "../services/useCartStore";

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartModal({ isOpen, onClose }: CartModalProps) {
  const { items, removeItem, clearCart } = useCartStore();

  if (!isOpen) return null;

  // Calcula o valor total em ETH convertendo para número de forma segura
  const totalPrice = items.reduce(
    (sum, item) => sum + Number(item.nft.priceEth) * item.quantity,
    0,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">
            O seu Carrinho de NFTs
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Lista de Itens */}
        <div className="p-6 overflow-y-auto flex-grow divide-y divide-slate-100">
          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-2">🛒</p>
              <p>O teu carrinho está vazio.</p>
            </div>
          ) : (
            items.map((item) => {
              const itemPrice = Number(item.nft.priceEth);
              return (
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
                      {itemPrice} ETH x {item.quantity}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 block text-sm">
                      {(itemPrice * item.quantity).toFixed(2)} ETH
                    </span>
                    <button
                      onClick={() => removeItem(item.nft.id)}
                      className="text-xs text-red-500 hover:text-red-700 mt-1 cursor-pointer font-medium"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé com Total e Ações */}
        {items.length > 0 && (
          <div className="p-6 border-t bg-slate-50">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-600 font-medium">
                Total estimado:
              </span>
              <span className="text-xl font-extrabold text-blue-600">
                {totalPrice.toFixed(2)} ETH
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={clearCart}
                className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-xl font-medium transition-colors cursor-pointer text-sm"
              >
                Esvaziar
              </button>
              <button
                onClick={() => {
                  alert("Compra finalizada com sucesso! Parabéns!");
                  clearCart();
                  onClose();
                }}
                className="w-2/3 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium transition-colors cursor-pointer text-sm shadow-sm"
              >
                Finalizar Compra
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
