import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Field } from "../components/Field";
import FilterDropdown from "../components/FilterDropdown";
import NftCard from "../components/NftCard";
import { EmptyState, ErrorState } from "../components/states";
import { parseError } from "../services/api";
import {
  fetchFacets,
  fetchNfts,
  fetchPosts,
  subscribeNewsletter,
} from "../services/endpoints";
import type { CatalogParams } from "../services/endpoints";
import { formatEth } from "../utils/money";

const route = getRouteApi("/");

const newsletterSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});

function Newsletter() {
  const form = useForm<z.infer<typeof newsletterSchema>>({
    resolver: zodResolver(newsletterSchema),
  });
  const mutation = useMutation({
    mutationFn: (v: { email: string }) => subscribeNewsletter(v.email),
    onSuccess: () => form.reset(),
    onError: (e) => {
      const err = parseError(e);
      form.setError("email", { message: err.fields.email ?? err.message });
    },
  });

  return (
    <section
      aria-labelledby="newsletter-title"
      className="rounded-xl bg-foreground p-6 text-background md:p-10"
    >
      <h2 id="newsletter-title" className="text-2xl font-bold">
        Receba as novidades
      </h2>
      <p className="mt-1 text-sm opacity-80">
        Lançamentos de coleções e mudanças de taxa de rede no seu e-mail.
      </p>
      <form
        className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start"
        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        noValidate
      >
        <div className="flex-1 [&_label]:text-background [&_p]:text-red-300">
          <Field label="E-mail" error={form.formState.errors.email?.message}>
            {(p) => (
              <Input
                type="email"
                autoComplete="email"
                className="bg-background text-foreground"
                {...p}
                {...form.register("email")}
              />
            )}
          </Field>
        </div>
        <Button
          type="submit"
          className="sm:mt-[1.625rem]"
          loading={mutation.isPending}
        >
          Assinar
        </Button>
      </form>
      {mutation.isSuccess && (
        <p role="status" className="mt-3 text-sm">
          Inscrição confirmada. Obrigado!
        </p>
      )}
    </section>
  );
}

// Dois cards empilhados e levemente rotacionados com os NFTs mais curtidos
// (dados reais da API; nenhum número é inventado).
function HeroCards() {
  const top = useQuery({
    queryKey: ["nfts", { hero: true }],
    queryFn: ({ signal }) =>
      fetchNfts({ sort: "popular", pageSize: 2 }, signal),
  });

  if (!top.data) {
    return <Skeleton className="mx-auto aspect-[4/5] w-full max-w-sm" />;
  }

  const [first, second] = top.data.items;
  return (
    <div
      className="relative mx-auto w-full max-w-sm px-3 pb-8"
      aria-label="NFTs em destaque"
      role="group"
    >
      {second && (
        <Card className="absolute top-6 left-0 w-[85%] rotate-[-6deg] gap-0 p-3 shadow-card">
          <img
            src={second.image}
            alt={second.title}
            className="aspect-[4/3] w-full rounded-2xl object-cover"
          />
        </Card>
      )}
      {first && (
        <Link to="/nfts/$id" params={{ id: first.id }} className="block">
          <Card className="hover-lift relative ml-auto w-[88%] rotate-[4deg] gap-3 p-3 shadow-float">
            <img
              src={first.image}
              alt={first.title}
              className="aspect-[4/3] w-full rounded-2xl object-cover"
            />
            <div className="grid grid-cols-2 gap-3 px-1 pb-1">
              <div>
                <span className="block text-xs font-medium text-muted-foreground">
                  Preço
                </span>
                <span className="text-xl font-bold">
                  {formatEth(first.priceEth)} ETH
                </span>
              </div>
              <div>
                <span className="block text-xs font-medium text-muted-foreground">
                  Disponíveis
                </span>
                <span className="text-xl font-bold">
                  {first.availableQuantity}
                </span>
              </div>
            </div>
          </Card>
        </Link>
      )}
    </div>
  );
}

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-[1.75rem] leading-8 font-bold">{value}</p>
      <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden="true" className="size-2 rounded-sm bg-brand" />
        {label}
      </p>
    </div>
  );
}

export default function Home() {
  const search = route.useSearch();
  const navigate = useNavigate();

  const params: CatalogParams = { ...search, pageSize: 9 };

  const update = (patch: Partial<CatalogParams>) =>
    navigate({
      to: "/",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        ...patch,
        // qualquer mudança de filtro volta para a primeira página
        page: "page" in patch ? patch.page : undefined,
      }),
    });

  const nfts = useQuery({
    queryKey: ["nfts", params],
    queryFn: ({ signal }) => fetchNfts(params, signal),
    placeholderData: (previous) => previous,
  });
  const posts = useQuery({ queryKey: ["posts"], queryFn: fetchPosts });
  const totals = useQuery({
    queryKey: ["facets", { overview: true }],
    queryFn: ({ signal }) => fetchFacets({}, signal),
  });

  const hasFilters = Object.keys(search).some(
    (k) => k !== "page" && k !== "sort",
  );
  const clearAll = () => navigate({ to: "/", search: {} });

  return (
    <div className="flex flex-col gap-16">
      <section
        aria-labelledby="hero-title"
        className="grid items-center gap-10 overflow-hidden rounded-xl bg-secondary p-6 md:p-10 lg:grid-cols-2"
      >
        <div className="flex flex-col gap-5">
          <h1
            id="hero-title"
            className="text-4xl leading-[2.625rem] font-bold md:text-display md:leading-[4rem]"
          >
            Descubra, colecione e negocie{" "}
            <span className="text-primary">NFTs</span> com a sua carteira.
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Cotação de taxa de rede em tempo real, pedidos idempotentes e
            confirmação instantânea.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href="#catalogo">Explorar catálogo</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/register">Criar conta</Link>
            </Button>
          </div>
          <dl
            aria-label="Números do catálogo"
            className="mt-4 grid grid-cols-3 gap-4"
          >
            <StatBlock
              value={
                totals.data?.collections.reduce((t, c) => t + c.count, 0) ?? 0
              }
              label="NFTs no catálogo"
            />
            <StatBlock
              value={totals.data?.collections.length ?? 0}
              label="Coleções"
            />
            <StatBlock
              value={totals.data?.networks.length ?? 0}
              label="Redes"
            />
          </dl>
        </div>
        <HeroCards />
      </section>

      <section id="catalogo" aria-labelledby="catalog-title" className="scroll-mt-24">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="catalog-title" className="text-2xl font-bold">
              Catálogo
            </h2>
            <p
              className="text-sm text-muted-foreground"
              aria-live="polite"
              data-testid="result-count"
            >
              {nfts.data
                ? `${nfts.data.total} ${nfts.data.total === 1 ? "resultado" : "resultados"}`
                : "Carregando..."}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <FilterDropdown params={params} onChange={update} onClear={clearAll} />
        </div>

        {nfts.isError && (
          <ErrorState
            message={`Erro ao carregar o catálogo: ${parseError(nfts.error).message}`}
            onRetry={() => nfts.refetch()}
          />
        )}

        {nfts.isLoading && (
          <div
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy="true"
            data-testid="catalog-skeleton"
          >
            {Array.from({ length: 6 }, (_, i) => (
              <Card key={i} className="gap-3 p-3">
                <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </Card>
            ))}
          </div>
        )}

        {nfts.data && nfts.data.items.length === 0 && (
          <EmptyState
            title="Nenhum NFT encontrado"
            description="Ajuste a busca ou limpe os filtros para ver mais resultados."
          >
            {hasFilters && (
              <Button variant="outline" onClick={clearAll}>
                Limpar filtros
              </Button>
            )}
          </EmptyState>
        )}

        {nfts.data && nfts.data.items.length > 0 && (
          <>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {nfts.data.items.map((nft) => (
                <li key={nft.id}>
                  <NftCard nft={nft} />
                </li>
              ))}
            </ul>

            <nav
              aria-label="Paginação"
              className="mt-8 flex items-center justify-center gap-4"
            >
              <Button
                variant="outline"
                size="sm"
                disabled={nfts.data.page <= 1}
                onClick={() => update({ page: nfts.data!.page - 1 })}
              >
                Anterior
              </Button>
              <span data-testid="page-indicator" className="text-sm">
                Página {nfts.data.page} de {nfts.data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={nfts.data.page >= nfts.data.totalPages}
                onClick={() => update({ page: nfts.data!.page + 1 })}
              >
                Próxima
              </Button>
            </nav>
          </>
        )}
      </section>

      <section aria-labelledby="blog-title">
        <h2 id="blog-title" className="mb-4 text-2xl font-bold">
          Novidades
        </h2>
        <ul className="grid gap-6 md:grid-cols-3">
          {(posts.data ?? []).map((post) => (
            <li key={post.id}>
              <Card className="h-full gap-1 p-5 shadow-card">
                <article>
                  <time
                    dateTime={post.publishedAt}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {new Date(post.publishedAt).toLocaleDateString("pt-BR")}
                  </time>
                  <h3 className="mt-1 text-lg font-semibold">{post.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {post.excerpt}
                  </p>
                </article>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <Newsletter />
    </div>
  );
}
