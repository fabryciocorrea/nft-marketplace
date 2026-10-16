// Cenários configuráveis da API simulada (latência, falhas, sessão expirada...)

export interface Scenario {
  latencyMs: number; // atraso aplicado a toda requisição
  failRate: number; // 0..1, chance de 503 em rotas de dados
  serverError: boolean; // 500 em todas as rotas de dados
  sessionExpired: boolean; // revoga a sessão na próxima requisição autenticada
  sessionBlip: boolean; // 401 uma única vez, mas a sessão continua válida
  rejectOrders: boolean; // pedidos terminam como "failed"
  favoritesFail: boolean; // PUT/DELETE de favoritos falham com 500
}

const KEY = "kurio:scenario";

export const DEFAULT_SCENARIO: Scenario = {
  latencyMs: 0,
  failRate: 0,
  serverError: false,
  sessionExpired: false,
  sessionBlip: false,
  rejectOrders: false,
  favoritesFail: false,
};

let current: Scenario | null = null;

export function getScenario(): Scenario {
  if (current) return current;
  try {
    const raw = localStorage.getItem(KEY);
    current = raw
      ? { ...DEFAULT_SCENARIO, ...(JSON.parse(raw) as Partial<Scenario>) }
      : { ...DEFAULT_SCENARIO };
  } catch {
    current = { ...DEFAULT_SCENARIO };
  }
  return current;
}

export function setScenario(patch: Partial<Scenario>) {
  current = { ...getScenario(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // storage indisponível: o cenário vale só em memória
  }
  return current;
}

export function resetScenario() {
  current = { ...DEFAULT_SCENARIO };
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
  return current;
}

// ?scenario=slow,flaky,server-error,session-expired,reject-orders,favorites-fail
export function applyScenarioFromUrl(search: string) {
  const names = new URLSearchParams(search).get("scenario");
  if (!names) return;
  const patch: Partial<Scenario> = {};
  for (const name of names.split(",")) {
    if (name === "slow") patch.latencyMs = 1500;
    if (name === "flaky") patch.failRate = 0.3;
    if (name === "server-error") patch.serverError = true;
    if (name === "session-expired") patch.sessionExpired = true;
    if (name === "session-blip") patch.sessionBlip = true;
    if (name === "reject-orders") patch.rejectOrders = true;
    if (name === "favorites-fail") patch.favoritesFail = true;
    if (name === "none") resetScenario();
  }
  setScenario(patch);
}
