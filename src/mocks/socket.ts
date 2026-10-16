import { ws } from "msw";
import { toSocketIo } from "@mswjs/socket.io-binding";
import { subscribe } from "./bus";
import type { DomainEvent } from "./bus";
import { db, refresh } from "./db";
import { findSession } from "./http";

// Servidor Socket.IO simulado. O cliente nunca emite estes eventos: eles
// nascem de mudanças no "banco" (db.ts) e chegam por aqui.

interface Envelope {
  eventId: string;
  resource: string;
  id: string;
  version: number;
  occurredAt: string;
  payload: unknown;
}

interface Connection {
  userId: string | null;
  send: (name: string, envelope: Envelope) => void;
  close: () => void;
}

const connections = new Set<Connection>();
let seq = 0;
let lastEvent: { name: string; envelope: Envelope; ownerId?: string } | null =
  null;

function deliver(name: string, envelope: Envelope, ownerId?: string) {
  for (const conn of connections) {
    if (ownerId && conn.userId !== ownerId) continue;
    conn.send(name, envelope);
  }
}

function toEnvelope(event: DomainEvent): Envelope {
  seq += 1;
  return {
    eventId: `evt_${Date.now().toString(36)}_${seq}`,
    resource: event.resource,
    id: event.id,
    version: event.version,
    occurredAt: new Date().toISOString(),
    payload: event.payload,
  };
}

subscribe((event) => {
  const envelope = toEnvelope(event);
  lastEvent = { name: event.name, envelope, ownerId: event.ownerId };
  deliver(event.name, envelope, event.ownerId);
});

// O MSW remove o prefixo /socket.io/ da URL antes de comparar, então o link
// casa com qualquer WebSocket da origem. Conexões que não são do Socket.IO
// (ex.: o HMR do Vite em desenvolvimento) seguem para o servidor real.
const link = ws.link("*");

export const socketHandlers = [
  link.addEventListener("connection", (connection) => {
    if (!connection.client.url.searchParams.has("EIO")) {
      connection.server.connect();
      return;
    }
    const io = toSocketIo(connection);
    const conn: Connection = {
      userId: null,
      send: (name, envelope) => io.client.emit(name, envelope),
      close: () => connection.client.close(1001, "server-drop"),
    };

    // Engine.IO exige ping periódico do servidor; sem ele o cliente reconecta
    const ping = setInterval(() => {
      try {
        connection.client.send("2");
      } catch {
        clearInterval(ping);
      }
    }, 20_000);

    connection.client.addEventListener("message", (event) => {
      const data = event.data;
      // Pacote CONNECT do Socket.IO: "40" + JSON de autenticação
      if (typeof data !== "string" || !data.startsWith("40")) return;
      let token = "";
      try {
        const auth = JSON.parse(data.slice(2) || "{}") as { token?: string };
        token = auth.token ?? "";
      } catch {
        token = "";
      }
      refresh();
      if (!token) {
        // Visitante: recebe apenas eventos públicos (nft.updated)
        connections.add(conn);
        return;
      }
      const session = findSession(token);
      if (!session || !db().users.some((u) => u.id === session.userId)) {
        connection.client.close(4401, "unauthorized");
        return;
      }
      conn.userId = session.userId;
      connections.add(conn);
    });

    connection.client.addEventListener("close", () => {
      clearInterval(ping);
      connections.delete(conn);
    });
  }),
];

// Ferramentas de teste (também expostas em window.__kurioMocks.socket)
export const socketTools = {
  count: () => connections.size,
  // Derruba todas as conexões: o cliente deve reconectar e reconciliar via REST
  dropAll: () => [...connections].forEach((c) => c.close()),
  // Reentrega o último evento (mesmo eventId): o cliente deve descartar
  replayLast: () => {
    if (lastEvent) {
      deliver(lastEvent.name, lastEvent.envelope, lastEvent.ownerId);
    }
  },
  // Entrega o último evento com versão antiga e novo eventId: deve ser descartado
  emitStale: () => {
    if (!lastEvent) return;
    seq += 1;
    const envelope: Envelope = {
      ...lastEvent.envelope,
      eventId: `evt_stale_${seq}`,
      version: Math.max(lastEvent.envelope.version - 1, 0),
    };
    deliver(lastEvent.name, envelope, lastEvent.ownerId);
  },
};
