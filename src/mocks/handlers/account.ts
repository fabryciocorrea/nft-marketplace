import { HttpResponse } from "msw";
import { commit, db, hashPassword, randomHex } from "../db";
import type { DbWallet } from "../db";
import { fail, validationError } from "../errors";
import { passwordProblem, route } from "../http";
import { NETWORKS } from "../fixtures/seed";
import type { Network } from "../fixtures/seed";
import { publicUser } from "./auth";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const MAX_AVATAR_BYTES = 200 * 1024;

function walletsOf(userId: string) {
  return db().wallets.filter((w) => w.userId === userId);
}

function publicWallet(w: DbWallet) {
  const { userId, ...rest } = w;
  void userId;
  return rest;
}

export const accountHandlers = [
  // ------------------------------------------------------------ perfil
  route(
    "get",
    "/profile",
    (ctx) => HttpResponse.json({ user: publicUser(ctx.user!) }),
    { auth: true },
  ),

  route(
    "patch",
    "/profile",
    async (ctx) => {
      const body = await ctx.body();
      const fields: Record<string, string> = {};
      if (body.name !== undefined) {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (name.length < 2) fields.name = "Informe o seu nome.";
      }
      const prefs = body.preferences as { newsletter?: unknown } | undefined;
      if (
        prefs !== undefined &&
        (typeof prefs !== "object" ||
          prefs === null ||
          (prefs.newsletter !== undefined &&
            typeof prefs.newsletter !== "boolean"))
      ) {
        fields.preferences = "Preferências inválidas.";
      }
      if (Object.keys(fields).length) return validationError(fields);

      if (typeof body.name === "string") ctx.user!.name = body.name.trim();
      if (prefs?.newsletter !== undefined) {
        ctx.user!.preferences.newsletter = prefs.newsletter as boolean;
      }
      commit();
      return HttpResponse.json({ user: publicUser(ctx.user!) });
    },
    { auth: true },
  ),

  route(
    "put",
    "/profile/avatar",
    async (ctx) => {
      const body = await ctx.body();
      const url = typeof body.url === "string" ? body.url : "";
      const isData = /^data:image\/(png|jpe?g|webp|svg\+xml);/.test(url);
      const isHttp = /^https:\/\//.test(url);
      if (!isData && !isHttp) {
        return validationError({
          url: "Envie uma imagem (data URL) ou um endereço https.",
        });
      }
      if (url.length > MAX_AVATAR_BYTES) {
        return validationError({ url: "A imagem deve ter até 200 KB." });
      }
      ctx.user!.avatar = url;
      commit();
      return HttpResponse.json({ user: publicUser(ctx.user!) });
    },
    { auth: true },
  ),

  route(
    "post",
    "/profile/password",
    async (ctx) => {
      const body = await ctx.body();
      const current =
        typeof body.currentPassword === "string" ? body.currentPassword : "";
      const problem = passwordProblem(body.newPassword);
      if (problem) return validationError({ newPassword: problem });

      const hash = await hashPassword(ctx.user!.salt, current);
      if (hash !== ctx.user!.passwordHash) {
        return fail("WRONG_PASSWORD", {
          details: { fields: { currentPassword: "Senha atual incorreta." } },
        });
      }
      ctx.user!.salt = `kurio:${randomHex(8)}:`;
      ctx.user!.passwordHash = await hashPassword(
        ctx.user!.salt,
        body.newPassword as string,
      );
      // Troca de senha encerra as demais sessões
      for (const s of db().sessions) {
        if (s.userId === ctx.user!.id && s.token !== ctx.session!.token) {
          s.revoked = true;
        }
      }
      commit();
      return new HttpResponse(null, { status: 204 });
    },
    { auth: true },
  ),

  // ------------------------------------------------------------ carteiras
  route(
    "get",
    "/wallets",
    (ctx) => HttpResponse.json(walletsOf(ctx.user!.id).map(publicWallet)),
    { auth: true },
  ),

  route(
    "post",
    "/wallets",
    async (ctx) => {
      const body = await ctx.body();
      const fields: Record<string, string> = {};
      const address = typeof body.address === "string" ? body.address.trim() : "";
      if (!ADDRESS_RE.test(address)) {
        fields.address = "Endereço inválido. Use 0x seguido de 40 hexadecimais.";
      }
      if (!NETWORKS.includes(body.network as Network)) {
        fields.network = `Rede inválida. Use: ${NETWORKS.join(", ")}.`;
      }
      if (
        body.label !== undefined &&
        (typeof body.label !== "string" || body.label.length > 30)
      ) {
        fields.label = "O apelido deve ter até 30 caracteres.";
      }
      if (Object.keys(fields).length) return validationError(fields);

      const mine = walletsOf(ctx.user!.id);
      if (mine.some((w) => w.address.toLowerCase() === address.toLowerCase())) {
        return fail("WALLET_DUPLICATED", {
          details: { fields: { address: "Carteira já cadastrada." } },
        });
      }
      const wallet: DbWallet = {
        id: `w-${randomHex(3)}`,
        userId: ctx.user!.id,
        address,
        network: body.network as Network,
        label:
          typeof body.label === "string" && body.label.trim()
            ? body.label.trim()
            : mine.length === 0
              ? "Principal"
              : "Secundária",
        isPrimary: mine.length === 0, // a primeira carteira é a principal
      };
      db().wallets.push(wallet);
      commit();
      return HttpResponse.json(publicWallet(wallet), { status: 201 });
    },
    { auth: true },
  ),

  route(
    "patch",
    "/wallets/:id",
    async (ctx) => {
      const wallet = db().wallets.find((w) => w.id === ctx.params.id);
      if (!wallet) return fail("NOT_FOUND", { message: "Carteira não encontrada." });
      if (wallet.userId !== ctx.user!.id) return fail("FORBIDDEN");

      const body = await ctx.body();
      if (body.label !== undefined) {
        if (typeof body.label !== "string" || body.label.length > 30) {
          return validationError({
            label: "O apelido deve ter até 30 caracteres.",
          });
        }
        wallet.label = body.label.trim();
      }
      if (body.isPrimary === false && wallet.isPrimary) {
        return fail("WALLET_PRIMARY_REQUIRED");
      }
      if (body.isPrimary === true) {
        for (const w of walletsOf(ctx.user!.id)) w.isPrimary = w.id === wallet.id;
      }
      commit();
      return HttpResponse.json(publicWallet(wallet));
    },
    { auth: true },
  ),

  route(
    "delete",
    "/wallets/:id",
    (ctx) => {
      const wallet = db().wallets.find((w) => w.id === ctx.params.id);
      if (!wallet) return fail("NOT_FOUND", { message: "Carteira não encontrada." });
      if (wallet.userId !== ctx.user!.id) return fail("FORBIDDEN");
      const mine = walletsOf(ctx.user!.id);
      if (mine.length === 1) return fail("LAST_WALLET");

      db().wallets = db().wallets.filter((w) => w.id !== wallet.id);
      if (wallet.isPrimary) {
        const next = db().wallets.find((w) => w.userId === ctx.user!.id);
        if (next) next.isPrimary = true;
      }
      commit();
      return new HttpResponse(null, { status: 204 });
    },
    { auth: true },
  ),
];
