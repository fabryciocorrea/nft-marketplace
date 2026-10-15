import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/field";
import { Card, EmptyState, ErrorState, Skeleton } from "../components/ui/misc";
import { useCart } from "../hooks/useCart";
import { useSession } from "../hooks/useSession";
import { parseError } from "../services/api";
import { clearAttemptKey, getAttemptKey } from "../services/attempt";
import { createOrder, createQuote, fetchWallets } from "../services/endpoints";
import { formatEth } from "../utils/money";

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function Checkout() {
  const { data: user } = useSession();
  const cart = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const wallets = useQuery({
    queryKey: ["wallets", user?.id],
    queryFn: fetchWallets,
    enabled: !!user,
  });

  const [walletId, setWalletId] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!walletId && wallets.data?.length) {
      const primary = wallets.data.find((w) => w.isPrimary) ?? wallets.data[0];
      setWalletId(primary.id);
    }
  }, [wallets.data, walletId]);

  const items = cart.rows.map((r) => ({
    nftId: r.nft.id,
    quantity: r.quantity,
  }));
  const fingerprint = JSON.stringify({
    items: [...items].sort((a, b) => a.nftId.localeCompare(b.nftId)),
    walletId,
    coupon: coupon ?? null,
  });

  const quote = useQuery({
    queryKey: ["quote", user?.id, fingerprint],
    queryFn: () =>
      createQuote({ items, walletId: walletId!, couponCode: coupon }),
    enabled: !!user && !!walletId && items.length > 0,
    retry: false,
    // Renova a cotação pouco antes de expirar
    refetchInterval: (q) =>
      q.state.data
        ? Math.max(Date.parse(q.state.data.expiresAt) - Date.now() - 5000, 1000)
        : false,
  });

  const order = useMutation({
    mutationFn: () =>
      createOrder(
        {
          items,
          walletId: walletId!,
          couponCode: coupon,
          quoteId: quote.data?.id,
        },
        getAttemptKey(fingerprint),
      ),
    onSuccess: (created) => {
      clearAttemptKey();
      queryClient.setQueryData(["orders", user?.id, created.id], created);
      queryClient.invalidateQueries({ queryKey: ["nfts"] });
      navigate({ to: "/order/$id", params: { id: created.id } });
    },
    onError: (error) => {
      const err = parseError(error);
      if (err.code === "QUOTE_EXPIRED" || err.code === "QUOTE_MISMATCH") {
        clearAttemptKey();
        quote.refetch();
      }
      if (err.code === "AVAILABILITY_CONFLICT") {
        queryClient.invalidateQueries({ queryKey: ["cart"] });
      }
    },
  });

  if (cart.isLoading || wallets.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (cart.rows.length === 0) {
    return (
      <EmptyState
        title="Não há itens para pagar"
        description="Adicione NFTs ao carrinho antes de seguir para o pagamento."
      >
        <Button asChild>
          <Link to="/" search={{}}>
            Explorar catálogo
          </Link>
        </Button>
      </EmptyState>
    );
  }

  if (wallets.data && wallets.data.length === 0) {
    return (
      <EmptyState
        title="Cadastre uma carteira para pagar"
        description="O pagamento é feito com uma carteira, na rede em que ela opera."
      >
        <Button asChild>
          <Link to="/wallets">Cadastrar carteira</Link>
        </Button>
      </EmptyState>
    );
  }

  const quoteError = quote.isError ? parseError(quote.error) : null;
  const orderError = order.isError ? parseError(order.error) : null;
  const q = quote.data;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Pagamento</h1>

        <section aria-labelledby="wallet-title">
          <h2 id="wallet-title" className="mb-3 text-lg font-bold">
            Carteira
          </h2>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Selecione a carteira de pagamento</legend>
            {(wallets.data ?? []).map((w) => (
              <label
                key={w.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${
                  walletId === w.id
                    ? "border-primary bg-elevated"
                    : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="wallet"
                  className="accent-primary"
                  checked={walletId === w.id}
                  onChange={() => setWalletId(w.id)}
                />
                <span className="flex-1">
                  <span className="block font-bold">
                    {w.label}
                    {w.isPrimary ? " · principal" : ""}
                  </span>
                  <span className="text-xs text-muted">
                    {shorten(w.address)} · {w.network}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </section>

        <section aria-labelledby="coupon-title">
          <h2 id="coupon-title" className="mb-3 text-lg font-bold">
            Cupom
          </h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setCoupon(couponInput.trim().toUpperCase() || undefined);
            }}
          >
            <label htmlFor="coupon" className="sr-only">
              Código do cupom
            </label>
            <Input
              id="coupon"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="Ex.: PROMO10"
              className="max-w-xs"
            />
            <Button type="submit" variant="outline">
              Aplicar
            </Button>
            {coupon && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCoupon(undefined);
                  setCouponInput("");
                }}
              >
                Remover
              </Button>
            )}
          </form>
          {quoteError?.code === "COUPON_INVALID" && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {quoteError.message}
            </p>
          )}
        </section>

        <section aria-labelledby="items-title">
          <h2 id="items-title" className="mb-3 text-lg font-bold">
            Itens
          </h2>
          <ul className="flex flex-col gap-2">
            {cart.rows.map((r) => (
              <li
                key={r.nft.id}
                className="flex justify-between gap-3 rounded-lg border border-line-soft bg-card p-3 text-sm"
              >
                <span>
                  {r.nft.title} × {r.quantity}
                </span>
                <span className="font-bold">{formatEth(r.lineTotal)} ETH</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside aria-labelledby="quote-title">
        <Card className="sticky top-24 p-5">
          <h2 id="quote-title" className="text-lg font-bold">
            Cotação
          </h2>

          {quote.isLoading && <Skeleton className="mt-4 h-28" />}

          {quoteError && quoteError.code !== "COUPON_INVALID" && (
            <div className="mt-4">
              <ErrorState
                message={quoteError.message}
                onRetry={() => quote.refetch()}
              />
            </div>
          )}

          {q && (
            <dl className="mt-4 flex flex-col gap-2 text-sm" data-testid="quote">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd data-testid="quote-subtotal">{formatEth(q.subtotal)} ETH</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Desconto</dt>
                <dd data-testid="quote-discount">{formatEth(q.discount)} ETH</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Taxa de rede ({q.network})</dt>
                <dd data-testid="quote-fee">{formatEth(q.networkFee)} ETH</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-line pt-3 text-base font-bold">
                <dt>Total</dt>
                <dd data-testid="quote-total" className="text-accent">
                  {formatEth(q.total)} ETH
                </dd>
              </div>
            </dl>
          )}

          {q && q.warnings.length > 0 && (
            <ul role="alert" className="mt-3 text-sm text-danger">
              {q.warnings.map((w) => (
                <li key={w.nftId}>{w.message}</li>
              ))}
            </ul>
          )}

          {orderError && (
            <p
              role="alert"
              data-testid="order-error"
              className="mt-4 rounded-lg border border-danger bg-danger/10 p-3 text-sm text-danger"
            >
              {orderError.message}
            </p>
          )}

          <Button
            className="mt-5 w-full"
            disabled={
              order.isPending ||
              !q ||
              q.warnings.length > 0 ||
              !walletId
            }
            onClick={() => order.mutate()}
          >
            {order.isPending ? "Enviando pedido..." : "Confirmar compra"}
          </Button>
          <p className="mt-2 text-xs text-secondary">
            A compra só é confirmada depois da resposta da API.
          </p>
        </Card>
      </aside>
    </div>
  );
}
