// Barramento interno: o "banco" publica eventos de domínio e o servidor
// Socket.IO simulado os entrega aos clientes conectados.

export interface DomainEvent {
  name: "nft.updated" | "order.updated";
  resource: "nft" | "order";
  id: string;
  version: number;
  ownerId?: string; // quando definido, só o dono recebe
  payload: unknown;
}

type Listener = (event: DomainEvent) => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publish(event: DomainEvent) {
  listeners.forEach((listener) => listener(event));
}
