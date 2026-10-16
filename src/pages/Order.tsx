import { useQuery } from "@tanstack/react-query";
import { Link, getRouteApi } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/states";
import { useSession } from "../hooks/useSession";
import { parseError } from "../services/api";
import { fetchOrder, fetchReceipt } from "../services/endpoints";
import { useRealtime } from "../services/socket";
import { formatEth } from "../utils/money";

const route = getRouteApi("/order/$id");

export default function OrderPage() {
  const { id } = route.useParams();
  const { data: user } = useSession();
  const connected = useRealtime((s) => s.connected);

  const order = useQuery({
    queryKey: ["orders", user?.id, id],
    queryFn: () => fetchOrder(id),
    enabled: !!user,
    retry: (count, error) => {
      const status = parseError(error).status;
      return status !== 403 && status !== 404 && count < 2;
    },
    // O evento order.updated (Socket.IO) atualiza o cache; o polling é só
    // contingência para quando o socket está fora do ar.
    refetchInterval: (q) =>
      q.state.data?.status === "pending" ? (connected ? 5000 : 1000) : false,
  });

  const confirmed = order.data?.status === "confirmed";
  const receipt = useQuery({
    queryKey: ["receipt", user?.id, id],
    queryFn: () => fetchReceipt(id),
    enabled: !!user && confirmed,
  });

  if (order.isLoading) return <Skeleton className="h-64 w-full" />;

  if (order.isError) {
    const err = parseError(order.error);
    if (err.status === 403 || err.status === 404) {
      return (
        <EmptyState
          level={1}
          title={err.status === 403 ? "Acesso negado" : "Pedido não encontrado"}
          description={err.message}
        >
          <Button asChild>
            <Link to="/orders">Ver meus pedidos</Link>
          </Button>
        </EmptyState>
      );
    }
    return (
      <ErrorState
        message={`Não foi possível carregar o pedido: ${err.message}`}
        onRetry={() => order.refetch()}
      />
    );
  }

  const o = order.data!;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div role="status" aria-live="polite" data-testid="order-status">
        {o.status === "pending" && (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-lg font-bold">Processando o seu pedido...</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Aguarde a confirmação. Você pode recarregar a página com
              segurança.
            </p>
          </div>
        )}
        {o.status === "confirmed" && (
          <div className="rounded-xl border border-success bg-success/10 p-6 text-center">
            <p className="text-lg font-bold text-success">Pedido confirmado!</p>
            <p className="mt-1 text-xs text-muted-foreground">Pedido {o.id}</p>
          </div>
        )}
        {o.status === "failed" && (
          <div className="rounded-xl border border-destructive bg-destructive/10 p-6 text-center">
            <p className="text-lg font-bold text-destructive">Pagamento recusado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nenhum valor foi cobrado e as edições voltaram ao estoque. Seus
              itens continuam no carrinho.
            </p>
          </div>
        )}
      </div>

      <Card className="p-5">
        <h1 className="text-lg font-bold">Recibo</h1>
        <ul className="mt-3 divide-y divide-line-soft">
          {o.items.map((item) => (
            <li key={item.nftId} className="flex items-center gap-3 py-3">
              <img
                src={item.image}
                alt=""
                className="h-12 w-12 rounded-lg object-cover"
              />
              <div className="flex-1 text-sm">
                <p className="font-bold">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatEth(item.unitPrice)} ETH × {item.quantity}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <dl className="mt-3 flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatEth(o.subtotal)} ETH</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Desconto</dt>
            <dd>{formatEth(o.discount)} ETH</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Taxa de rede ({o.network})</dt>
            <dd>{formatEth(o.networkFee)} ETH</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd data-testid="order-total" className="text-primary">
              {formatEth(o.total)} ETH
            </dd>
          </div>
        </dl>

        <dl className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Carteira</dt>
            <dd className="break-all">{o.walletAddress}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Data</dt>
            <dd>{new Date(o.createdAt).toLocaleString("pt-BR")}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Transação (simulada)</dt>
            <dd className="break-all">{o.txHash}</dd>
          </div>
        </dl>

        {receipt.data?.explorerUrl && (
          <p className="mt-4 text-sm">
            <a
              href={receipt.data.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              Ver no explorador de blocos
            </a>
          </p>
        )}
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/" search={{}}>
            Continuar comprando
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/orders">Meus pedidos</Link>
        </Button>
      </div>
    </div>
  );
}
