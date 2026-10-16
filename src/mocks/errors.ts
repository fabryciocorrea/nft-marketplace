import { HttpResponse } from "msw";

// Catálogo único de códigos de erro da API simulada
export const ERR = {
  VALIDATION_ERROR: { status: 422, message: "Dados inválidos." },
  INVALID_CREDENTIALS: { status: 401, message: "E-mail ou senha inválidos." },
  SESSION_INVALID: { status: 401, message: "Sessão inválida ou expirada." },
  WRONG_PASSWORD: { status: 403, message: "A senha atual está incorreta." },
  FORBIDDEN: { status: 403, message: "Você não tem acesso a este recurso." },
  NOT_FOUND: { status: 404, message: "Recurso não encontrado." },
  EMAIL_TAKEN: { status: 409, message: "Este e-mail já está cadastrado." },
  AVAILABILITY_CONFLICT: {
    status: 409,
    message: "Quantidade indisponível.",
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    status: 422,
    message: "O cabeçalho Idempotency-Key é obrigatório.",
  },
  IDEMPOTENCY_KEY_REUSED: {
    status: 409,
    message: "Esta chave de idempotência já foi usada com outro conteúdo.",
  },
  QUOTE_EXPIRED: { status: 409, message: "A cotação expirou. Gere outra." },
  QUOTE_MISMATCH: {
    status: 409,
    message: "A cotação não corresponde ao conteúdo do pedido.",
  },
  COUPON_INVALID: { status: 422, message: "Cupom inválido ou expirado." },
  WALLET_DUPLICATED: {
    status: 409,
    message: "Esta carteira já está cadastrada.",
  },
  WALLET_PRIMARY_REQUIRED: {
    status: 422,
    message: "É necessário manter uma carteira principal.",
  },
  LAST_WALLET: {
    status: 409,
    message: "Não é possível remover a única carteira.",
  },
  TOO_MANY_ATTEMPTS: {
    status: 429,
    message: "Muitas tentativas. Aguarde antes de tentar novamente.",
  },
  INTERNAL_ERROR: { status: 500, message: "Erro interno simulado." },
} as const;

export type ErrorCode = keyof typeof ERR;

export function fail(
  code: ErrorCode,
  options: {
    message?: string;
    details?: unknown;
    headers?: Record<string, string>;
  } = {},
) {
  const def = ERR[code];
  return HttpResponse.json(
    {
      error: {
        code,
        message: options.message ?? def.message,
        ...(options.details ? { details: options.details } : {}),
      },
    },
    { status: def.status, headers: options.headers },
  );
}

export function validationError(fields: Record<string, string>) {
  return fail("VALIDATION_ERROR", { details: { fields } });
}
