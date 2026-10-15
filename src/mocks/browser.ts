import { setupWorker } from "msw/browser";
import { initialNfts, mockUser } from "./fixtures/db";
import { http, HttpResponse } from "msw";

// Definimos os handlers básicos para listar os NFTs e o utilizador atual
export const handlers = [
  http.get("/api/nfts", () => {
    return HttpResponse.json(initialNfts);
  }),

  http.get("/api/auth/me", () => {
    return HttpResponse.json(mockUser);
  }),
];

export const worker = setupWorker(...handlers);
