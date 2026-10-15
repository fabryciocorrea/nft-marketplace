// Chave de idempotência: uma por tentativa de compra.
// Reenvios da MESMA compra reutilizam a chave; se o conteúdo mudou, nasce outra.
const ATTEMPT_KEY = "nft-marketplace:checkout-attempt";

export function getAttemptKey(fingerprint: string) {
  try {
    const saved = sessionStorage.getItem(ATTEMPT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as { key: string; fingerprint: string };
      if (parsed.fingerprint === fingerprint) return parsed.key;
    }
  } catch {
    // ignora e cria uma chave nova
  }
  const attempt = { key: crypto.randomUUID(), fingerprint };
  try {
    sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt));
  } catch {
    // storage indisponível: a chave vale só para esta chamada
  }
  return attempt.key;
}

export function clearAttemptKey() {
  try {
    sessionStorage.removeItem(ATTEMPT_KEY);
  } catch {
    // ignora
  }
}
