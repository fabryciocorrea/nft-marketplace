import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchFacets } from "../services/endpoints";
import type { CatalogParams } from "../services/endpoints";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/field";
import { Skeleton } from "./ui/misc";

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

interface Props {
  params: CatalogParams;
  onChange: (patch: Partial<CatalogParams>) => void;
  onClear: () => void;
}

export default function FilterPanel({ params, onChange, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(params.minPrice ?? "");
  const [max, setMax] = useState(params.maxPrice ?? "");

  useEffect(() => {
    setMin(params.minPrice ?? "");
    setMax(params.maxPrice ?? "");
  }, [params.minPrice, params.maxPrice]);

  const facets = useQuery({
    queryKey: ["facets", params],
    queryFn: ({ signal }) => fetchFacets(params, signal),
    placeholderData: (previous) => previous,
  });

  const selectedCollections = params.collection?.split(",") ?? [];
  const selectedNetworks = params.network?.split(",") ?? [];

  const applyPrice = () =>
    onChange({ minPrice: min || undefined, maxPrice: max || undefined });

  return (
    <aside aria-label="Filtros" className="flex flex-col gap-4">
      <Button
        variant="outline"
        className="md:hidden"
        aria-expanded={open}
        aria-controls="filters-body"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Ocultar filtros" : "Mostrar filtros"}
      </Button>

      <div
        id="filters-body"
        className={`flex flex-col gap-5 ${open ? "" : "hidden"} md:flex`}
      >
        <div>
          <label htmlFor="sort" className="mb-1.5 block text-xs font-bold text-muted">
            Ordenar por
          </label>
          <Select
            id="sort"
            value={params.sort ?? "recent"}
            onChange={(e) => onChange({ sort: e.target.value })}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-xs font-bold text-muted">Categoria</legend>
          <div className="flex flex-wrap gap-2">
            {[{ id: "All", name: "Todas", count: undefined }, ...(facets.data?.tabs ?? [])].map(
              (tab) => {
                const active = (params.tab ?? "All") === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      onChange({ tab: tab.id === "All" ? undefined : tab.id })
                    }
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-bold ${
                      active
                        ? "border-primary bg-primary text-ink"
                        : "border-line text-fg hover:bg-elevated"
                    }`}
                  >
                    {tab.name}
                    {tab.count !== undefined ? ` (${tab.count})` : ""}
                  </button>
                );
              },
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-xs font-bold text-muted">Coleções</legend>
          {!facets.data ? (
            <Skeleton className="h-24" />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {facets.data.collections.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={selectedCollections.includes(c.id)}
                      onChange={() =>
                        onChange({ collection: toggle(params.collection, c.id) })
                      }
                    />
                    <span>
                      {c.name} <span className="text-secondary">({c.count})</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-xs font-bold text-muted">Redes</legend>
          {!facets.data ? (
            <Skeleton className="h-16" />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {facets.data.networks.map((n) => (
                <li key={n.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={selectedNetworks.includes(n.id)}
                      onChange={() =>
                        onChange({ network: toggle(params.network, n.id) })
                      }
                    />
                    <span>
                      {n.name} <span className="text-secondary">({n.count})</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-xs font-bold text-muted">
            Faixa de preço (ETH)
          </legend>
          <div className="flex items-center gap-2">
            <Input
              aria-label="Preço mínimo"
              inputMode="decimal"
              placeholder="mín"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            />
            <Input
              aria-label="Preço máximo"
              inputMode="decimal"
              placeholder="máx"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            />
          </div>
        </fieldset>

        <Button variant="ghost" onClick={onClear}>
          Limpar filtros
        </Button>
      </div>
    </aside>
  );
}
