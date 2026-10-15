import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { useCartStore } from "../services/useCartStore";
import { useSession, SESSION_KEY } from "../hooks/useSession";
import { logout } from "../services/auth";
import CartModal from "../components/CartModal";
import LoginModal from "../components/LoginModal";
import type { NFT } from "../types";
import OrderModal from "../components/OrderModal";
import { getPendingOrderId } from "../services/orders";

export default function Home() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: user } = useSession();
  const [orderId, setOrderId] = useState<string | null>(null);
  // Se houver um pedido em andamento (ex.: após refresh), ele reaparece
  const activeOrderId = user ? (orderId ?? getPendingOrderId(user.id)) : null;

  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const {
    data: nfts = [],
    isLoading,
    error,
  } = useQuery<NFT[]>({
    queryKey: ["nfts"],
    queryFn: async () => {
      const response = await api.get("/nfts");
      return response.data;
    },
  });

  const { items, addItem, clearCart } = useCartStore();

  const handleLogout = async () => {
    await logout();
    queryClient.setQueryData(SESSION_KEY, null);
    queryClient.removeQueries({ queryKey: ["orders"] }); // limpa dados privados do cache
    setOrderId(null);
    clearCart(); // evita que o próximo usuário veja o carrinho anterior
  };
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // Obter categorias únicas
  const categories = [
    "All",
    ...Array.from(new Set(nfts.map((nft) => nft.category))),
  ];

  // Filtrar NFTs
  const filteredNfts = nfts.filter((nft) => {
    const matchesCategory =
      selectedCategory === "All" || nft.category === selectedCategory;
    const matchesSearch =
      nft.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nft.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Gerar iniciais do utilizador para o avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Cabeçalho */}
      <header className="border-b bg-white px-8 py-4 shadow-sm flex justify-between items-center sticky top-0 z-40">
        <h1 className="text-xl font-bold text-blue-600">NFT Marketplace</h1>

        <div className="flex gap-6 items-center">
          {/* Botão do Carrinho */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative bg-slate-100 hover:bg-slate-200 transition-colors px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 cursor-pointer"
          >
            🛒 Carrinho
            {totalItems > 0 && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {totalItems}
              </span>
            )}
          </button>

          {/* Autenticação: Se logado mostra perfil, se não mostra botão "Entrar" */}
          {user ? (
            <div className="flex gap-3 items-center">
              <span className="text-sm font-medium text-slate-600">
                {user.name}
              </span>
              <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                {getInitials(user.name)}
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-red-500 hover:underline ml-2 cursor-pointer"
                title="Terminar Sessão"
              >
                Sair
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsLoginOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer shadow-sm"
            >
              Entrar
            </button>
          )}
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">
              Descoberta de NFTs
            </h2>
            <p className="text-slate-500 mt-1">
              Explora, recolhe e negoceia artes digitais exclusivas.
            </p>
          </div>

          {/* Barra de Pesquisa e Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="Pesquisar NFTs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    selectedCategory === category
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-12 text-slate-500">
            A carregar o catálogo...
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-200">
            Erro ao carregar o catálogo de NFTs.
          </div>
        )}

        {!isLoading && !error && filteredNfts.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-4xl mb-2">🔍</p>
            <p className="text-slate-600 font-medium">
              Nenhum NFT encontrado com essa pesquisa.
            </p>
          </div>
        )}

        {!isLoading && !error && filteredNfts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredNfts.map((nft) => {
              const itemPrice = Number(nft.priceEth);
              return (
                <div
                  key={nft.id}
                  className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md transition-shadow"
                >
                  <img
                    src={nft.image}
                    alt={nft.title}
                    className="h-48 w-full object-cover"
                  />
                  <div className="p-5 flex flex-col flex-grow">
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
                      {nft.category}
                    </span>
                    <h3 className="text-lg font-bold text-slate-800">
                      {nft.title}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 flex-grow">
                      {nft.description}
                    </p>

                    <div className="mt-6 pt-4 border-t flex justify-between items-center">
                      <div>
                        <span className="text-xs text-slate-400 block">
                          Preço atual
                        </span>
                        <span className="text-base font-bold text-slate-900">
                          {itemPrice} ETH
                        </span>
                      </div>
                      <button
                        onClick={() => addItem(nft)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                      >
                        Comprar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modais */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        user={user}
        onRequireLogin={() => setIsLoginOpen(true)}
        onOrderCreated={(id) => {
          setOrderId(id);
          setIsCartOpen(false);
        }}
      />
      <OrderModal
        orderId={activeOrderId}
        userId={user?.id ?? ""}
        onClose={() => setOrderId(null)}
      />
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  );
}
