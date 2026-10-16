import type { Socket } from "socket.io-client";
import type { QueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { getToken } from "./api";
import type { NFT, Order, Page } from "../types";

// Estado de conexão exibido na interface (rodapé)
export const useRealtime = create<{
  connected: boolean;
  events: number;
  discarded: number;
}>(() => ({ connected: false, events: 0, discarded: 0 }));

interface Envelope {
  eventId: string;
  resource: "nft" | "order";
  id: string;
  version: number;
  occurredAt: string;
  payload: Record<string, unknown>;
}

let socket: Socket | null = null;
// Duplicatas (eventId) e versões antigas são descartadas
const seenIds = new Set<string>();
const versions = new Map<string, number>();

function patchNft(
  queryClient: QueryClient,
  id: string,
  version: number,
  payload: Record<string, unknown>,
) {
  const patch = (nft: NFT): NFT =>
    nft.id === id ? { ...nft, ...(payload as Partial<NFT>), version } : nft;

  queryClient.setQueriesData<NFT>({ queryKey: ["nft", id] }, (old) =>
    old ? patch(old) : old,
  );
  queryClient.setQueriesData<Page<NFT>>({ queryKey: ["nfts"] }, (old) =>
    old ? { ...old, items: old.items.map(patch) } : old,
  );
}

function handleEvent(queryClient: QueryClient, envelope: Envelope) {
  const state = useRealtime.getState();
  const key = `${envelope.resource}:${envelope.id}`;

  if (seenIds.has(envelope.eventId)) {
    useRealtime.setState({ discarded: state.discarded + 1 });
    return;
  }
  seenIds.add(envelope.eventId);
  if (seenIds.size > 500) seenIds.delete(seenIds.values().next().value!);

  const known = versions.get(key) ?? 0;
  if (envelope.version <= known) {
    useRealtime.setState({ discarded: state.discarded + 1 });
    return;
  }
  versions.set(key, envelope.version);
  useRealtime.setState({ events: state.events + 1 });

  if (envelope.resource === "nft") {
    patchNft(queryClient, envelope.id, envelope.version, envelope.payload);
    // O estoque mudou: o carrinho e o resumo do pedido podem ter mudado
    queryClient.invalidateQueries({ queryKey: ["cart"] });
  } else if (envelope.resource === "order") {
    const order = envelope.payload as unknown as Order;
    queryClient.setQueriesData<Order>(
      { queryKey: ["orders"], predicate: (q) => q.queryKey[2] === order.id },
      () => order,
    );
    queryClient.invalidateQueries({ queryKey: ["orders-list"] });
    // Confirmado: o servidor retirou os itens comprados do carrinho
    queryClient.invalidateQueries({ queryKey: ["cart"] });
  }
}

// Reconciliação: depois de conectar/reconectar, relê o estado via REST
function reconcile(queryClient: QueryClient) {
  versions.clear();
  for (const key of ["nfts", "nft", "orders", "orders-list", "cart"]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

// O socket.io-client guarda o WebSocket global ao ser carregado. Por isso ele
// é importado sob demanda: só depois de o MSW ter assumido o WebSocket.
let generation = 0;

export async function connectSocket(queryClient: QueryClient) {
  disconnectSocket();
  const current = ++generation;
  const { io } = await import("socket.io-client");
  if (current !== generation) return; // desconectado enquanto carregava
  const s = io(window.location.origin, {
    path: "/socket.io",
    transports: ["websocket"],
    forceNew: true, // cada conexão tem o próprio Manager (evita reaproveitar um fechado)
    // Lida a cada tentativa: reconectar usa o token mais recente
    auth: (cb) => cb({ token: getToken() ?? "" }),
    reconnectionDelay: 300,
    reconnectionDelayMax: 2000,
  });
  socket = s;

  s.on("connect", () => {
    useRealtime.setState({ connected: true });
    reconcile(queryClient);
  });
  s.on("disconnect", () => useRealtime.setState({ connected: false }));
  s.on("nft.updated", (env: Envelope) => handleEvent(queryClient, env));
  s.on("order.updated", (env: Envelope) => handleEvent(queryClient, env));
}

// Logout/expiração: remove todos os listeners e fecha a conexão
export function disconnectSocket() {
  generation += 1;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  seenIds.clear();
  versions.clear();
  useRealtime.setState({ connected: false });
}
