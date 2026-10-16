import { HttpResponse } from "msw";
import { bumpNft, commit, db, publicNft } from "../db";
import { fail } from "../errors";
import { route } from "../http";
import { getScenario } from "../scenarios";

export const favoritesHandlers = [
  route(
    "get",
    "/favorites",
    (ctx) => {
      const ids = db().favorites[ctx.user!.id] ?? [];
      const items = db()
        .nfts.filter((n) => ids.includes(n.id))
        .map((n) => publicNft(n, ctx.user!.id));
      return HttpResponse.json(items);
    },
    { auth: true },
  ),

  // PUT e DELETE são idempotentes: repetir não altera likes duas vezes
  route(
    "put",
    "/favorites/:nftId",
    (ctx) => {
      if (getScenario().favoritesFail) return fail("INTERNAL_ERROR");
      const { nftId } = ctx.params;
      if (!db().nfts.some((n) => n.id === nftId)) {
        return fail("NOT_FOUND", { message: "NFT não encontrado." });
      }
      const list = (db().favorites[ctx.user!.id] ??= []);
      if (!list.includes(nftId)) {
        list.push(nftId);
        bumpNft(nftId);
        commit();
      }
      return new HttpResponse(null, { status: 204 });
    },
    { auth: true },
  ),

  route(
    "delete",
    "/favorites/:nftId",
    (ctx) => {
      if (getScenario().favoritesFail) return fail("INTERNAL_ERROR");
      const { nftId } = ctx.params;
      if (!db().nfts.some((n) => n.id === nftId)) {
        return fail("NOT_FOUND", { message: "NFT não encontrado." });
      }
      const list = db().favorites[ctx.user!.id] ?? [];
      if (list.includes(nftId)) {
        db().favorites[ctx.user!.id] = list.filter((id) => id !== nftId);
        bumpNft(nftId);
        commit();
      }
      return new HttpResponse(null, { status: 204 });
    },
    { auth: true },
  ),
];
