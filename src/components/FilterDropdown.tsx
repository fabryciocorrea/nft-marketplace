import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { nativeSelectClass } from "./Field";
import { fetchFacets } from "../services/endpoints";
import type { CatalogParams } from "../services/endpoints";
import type { Facets } from "../types";

const SORTS = [
  { value: "recent", label: "Mais recentes" },
  { value: "popular", label: "Mais curtidos" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
];

function toggle(csv: string | undefined, value: string) {
  const list = csv ? csv.split(",") : [];
  const next = list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
  return next.length ? next.join(",") : undefined;
}

// true em telas >= 768 px: popover; abaixo disso, folha inferior (Sheet)
function useIsDesktop() {
  const query = "(min-width: 768px)";
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);
  return matches;
}

interface Props {
  params: CatalogParams;
  onChange: (patch: Partial<CatalogParams>) => void;
  onClear: () => void;
}

// Corpo do filtro: todos os atributos do catálogo em um único lugar
function FilterBody({
  params,
  facets,
  onChange,
  onClear,
  onDone,
}: Props & { facets: Facets | undefined; onDone: () => void }) {
  const [min, setMin] = useState(params.minPrice ?? "");
  const [max, setMax] = useState(params.maxPrice ?? "");

  useEffect(() => {
    setMin(params.minPrice ?? "");
    setMax(params.maxPrice ?? "");
  }, [params.minPrice, params.maxPrice]);

  const collections = params.collection?.split(",") ?? [];
  const networks = params.network?.split(",") ?? [];
  const applyPrice = () =>
    onChange({ minPrice: min || undefined, maxPrice: max || undefined });

  return (
    <>
      <div className="flex flex-col gap-5 p-4">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Categoria</legend>
          <Tabs
            value={params.tab ?? "All"}
            onValueChange={(value) =>
              onChange({ tab: value === "All" ? undefined : value })
            }
          >
            <TabsList className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto">
              {[
                {
                  id: "All",
                  name: "Todas",
                  count: undefined as number | undefined,
                },
                ...(facets?.tabs ?? []),
              ].map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="h-9 flex-none rounded-full border-input px-3 text-foreground data-active:border-primary data-active:bg-primary data-active:text-primary-foreground"
                >
                  {tab.name}
                  {tab.count !== undefined ? ` (${tab.count})` : ""}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </fieldset>

        <div>
          <Label htmlFor="sort" className="mb-2 text-sm font-semibold">
            Ordenar por
          </Label>
          <select
            id="sort"
            className={nativeSelectClass}
            value={params.sort ?? "recent"}
            onChange={(e) =>
              onChange({
                sort: e.target.value === "recent" ? undefined : e.target.value,
              })
            }
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Coleções</legend>
          {!facets ? (
            <Skeleton className="h-24" />
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {facets.collections.map((c) => (
                <li key={c.id}>
                  <Label className="cursor-pointer gap-2 font-normal">
                    <Checkbox
                      checked={collections.includes(c.id)}
                      onCheckedChange={() =>
                        onChange({ collection: toggle(params.collection, c.id) })
                      }
                    />
                    <span>
                      {c.name}{" "}
                      <span className="text-muted-foreground">({c.count})</span>
                    </span>
                  </Label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Redes</legend>
          {!facets ? (
            <Skeleton className="h-10" />
          ) : (
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {facets.networks.map((n) => (
                <li key={n.id}>
                  <Label className="cursor-pointer gap-2 font-normal">
                    <Checkbox
                      checked={networks.includes(n.id)}
                      onCheckedChange={() =>
                        onChange({ network: toggle(params.network, n.id) })
                      }
                    />
                    <span>
                      {n.name}{" "}
                      <span className="text-muted-foreground">({n.count})</span>
                    </span>
                  </Label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            Faixa de preço (ETH)
          </legend>
          <div className="flex items-center gap-2">
            <Input
              aria-label="Preço mínimo"
              inputMode="decimal"
              placeholder="Mín."
              value={min}
              onChange={(e) => setMin(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            />
            <span aria-hidden="true" className="text-muted-foreground">
              –
            </span>
            <Input
              aria-label="Preço máximo"
              inputMode="decimal"
              placeholder="Máx."
              value={max}
              onChange={(e) => setMax(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            />
          </div>
          {facets && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Catálogo: {facets.priceRange.min} a {facets.priceRange.max} ETH
            </p>
          )}
        </fieldset>
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t bg-popover p-3">
        <Button variant="ghost" size="sm" onClick={onClear}>
          Limpar filtros
        </Button>
        <Button size="sm" onClick={onDone}>
          Concluir
        </Button>
      </div>
    </>
  );
}

// Um único dropdown composto com todos os atributos do catálogo (categoria,
// ordenação, coleções, redes e preço). Em telas pequenas abre como folha
// inferior. Os filtros ativos aparecem ao lado como chips removíveis.
export default function FilterDropdown({ params, onChange, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const facets = useQuery({
    queryKey: ["facets", params],
    queryFn: ({ signal }) => fetchFacets(params, signal),
    placeholderData: (previous) => previous,
  });

  const collections = params.collection?.split(",") ?? [];
  const networks = params.network?.split(",") ?? [];
  const hasPrice = !!(params.minPrice || params.maxPrice);
  const sortChanged = !!params.sort && params.sort !== "recent";

  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (params.tab) {
    chips.push({
      key: "tab",
      label: `Categoria: ${params.tab}`,
      remove: () => onChange({ tab: undefined }),
    });
  }
  for (const id of collections) {
    const name = facets.data?.collections.find((c) => c.id === id)?.name ?? id;
    chips.push({
      key: `c-${id}`,
      label: `Coleção: ${name}`,
      remove: () => onChange({ collection: toggle(params.collection, id) }),
    });
  }
  for (const id of networks) {
    chips.push({
      key: `n-${id}`,
      label: `Rede: ${id}`,
      remove: () => onChange({ network: toggle(params.network, id) }),
    });
  }
  if (hasPrice) {
    chips.push({
      key: "price",
      label: `Preço: ${params.minPrice || "0"} – ${params.maxPrice || "∞"} ETH`,
      remove: () => onChange({ minPrice: undefined, maxPrice: undefined }),
    });
  }
  if (sortChanged) {
    chips.push({
      key: "sort",
      label: `Ordem: ${SORTS.find((s) => s.value === params.sort)?.label ?? params.sort}`,
      remove: () => onChange({ sort: undefined }),
    });
  }

  const trigger = (
    <Button variant="outline">
      <SlidersHorizontalIcon aria-hidden="true" />
      Filtros
      {chips.length > 0 && (
        <Badge className="ml-1 h-5 min-w-5 rounded-full px-1.5">
          {chips.length}
        </Badge>
      )}
    </Button>
  );

  const body = (
    <FilterBody
      params={params}
      facets={facets.data}
      onChange={onChange}
      onClear={onClear}
      onDone={() => setOpen(false)}
    />
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isDesktop ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            align="start"
            aria-label="Filtros do catálogo"
            className="max-h-[min(var(--radix-popover-content-available-height),36rem)] w-[26rem] gap-0 overflow-y-auto p-0"
          >
            {body}
          </PopoverContent>
        </Popover>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[85vh] gap-0 overflow-y-auto rounded-t-xl p-0"
          >
            <SheetHeader className="border-b">
              <SheetTitle>Filtros do catálogo</SheetTitle>
              <SheetDescription className="sr-only">
                Categoria, ordenação, coleções, redes e faixa de preço
              </SheetDescription>
            </SheetHeader>
            {body}
          </SheetContent>
        </Sheet>
      )}

      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          aria-label={`Remover filtro ${chip.label}`}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          {chip.label}
          <XIcon aria-hidden="true" className="size-3" />
        </button>
      ))}
    </div>
  );
}
