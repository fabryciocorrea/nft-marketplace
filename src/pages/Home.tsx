import { useMutation, useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import FilterPanel from "../components/FilterPanel";
import NftCard from "../components/NftCard";
import { Button } from "../components/ui/button";
import { Field, Input } from "../components/ui/field";
import { Card, EmptyState, ErrorState, Skeleton } from "../components/ui/misc";
import { parseError } from "../services/api";
import {
  fetchNfts,
  fetchPosts,
  subscribeNewsletter,
} from "../services/endpoints";
import type { CatalogParams } from "../services/endpoints";

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
      className="rounded-xl border border-line bg-elevated p-6"
    >
      <h2 id="newsletter-title" className="text-xl font-bold">
        Receba as novidades
      </h2>
      <p className="mt-1 text-sm text-muted">
        Lançamentos de coleções e mudanças de taxa de rede no seu e-mail.
      </p>
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start"
        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        noValidate
      >
        <div className="flex-1">
          <Field label="E-mail" error={form.formState.errors.email?.message}>
            {(p) => <Input type="email" autoComplete="email" {...p} {...form.register("email")} />}
          </Field>
        </div>
        <Button type="submit" className="sm:mt-6" disabled={mutation.isPending}>
          Assinar
        </Button>
      </form>
      {mutation.isSuccess && (
        <p role="status" className="mt-3 text-sm text-success">
          Inscrição confirmada. Obrigado!
        </p>
      )}
    </section>
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

  const hasFilters = Object.keys(search).some(
    (k) => k !== "page" && k !== "sort",
  );

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="hero-title" className="flex flex-col gap-4 py-6">
        <h1
          id="hero-title"
          className="max-w-3xl text-3xl font-bold leading-tight text-fg md:text-display"
        >
          Descubra, colecione e negocie NFTs com a sua carteira.
        </h1>
        <p className="max-w-2xl text-muted">
          Cotação de taxa de rede em tempo real, pedidos idempotentes e
          confirmação instantânea.
        </p>
        <div>
          <Button asChild>
            <a href="#catalogo">Explorar catálogo</a>
          </Button>
        </div>
      </section>

      <section
        id="catalogo"
        aria-labelledby="catalog-title"
        className="grid gap-8 md:grid-cols-[240px_1fr]"
      >
        <h2 id="catalog-title" className="sr-only">
          Catálogo de NFTs
        </h2>

        <FilterPanel
          params={params}
          onChange={update}
          onClear={() => navigate({ to: "/", search: {} })}
        />

        <div>
          <p
            className="mb-4 text-sm text-muted"
            aria-live="polite"
            data-testid="result-count"
          >
            {nfts.data
              ? `${nfts.data.total} ${nfts.data.total === 1 ? "resultado" : "resultados"}`
              : "Carregando..."}
          </p>

          {nfts.isError && (
            <ErrorState
              message={`Erro ao carregar o catálogo: ${parseError(nfts.error).message}`}
              onRetry={() => nfts.refetch()}
            />
          )}

          {nfts.isLoading && (
            <div
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              aria-busy="true"
              data-testid="catalog-skeleton"
            >
              {Array.from({ length: 6 }, (_, i) => (
                <Card key={i} className="p-3">
                  <Skeleton className="aspect-square w-full" />
                  <Skeleton className="mt-3 h-4 w-2/3" />
                  <Skeleton className="mt-2 h-4 w-1/3" />
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
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/", search: {} })}
                >
                  Limpar filtros
                </Button>
              )}
            </EmptyState>
          )}

          {nfts.data && nfts.data.items.length > 0 && (
            <>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {nfts.data.items.map((nft) => (
                  <li key={nft.id}>
                    <NftCard nft={nft} />
                  </li>
                ))}
              </ul>

              <nav
                aria-label="Paginação"
                className="mt-6 flex items-center justify-center gap-4"
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
        </div>
      </section>

      <section aria-labelledby="blog-title">
        <h2 id="blog-title" className="mb-4 text-xl font-bold">
          Novidades
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {(posts.data ?? []).map((post) => (
            <li key={post.id}>
              <Card className="h-full p-4">
                <article>
                  <time
                    dateTime={post.publishedAt}
                    className="text-xs text-secondary"
                  >
                    {new Date(post.publishedAt).toLocaleDateString("pt-BR")}
                  </time>
                  <h3 className="mt-1 font-bold">{post.title}</h3>
                  <p className="mt-1 text-sm text-muted">{post.excerpt}</p>
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
