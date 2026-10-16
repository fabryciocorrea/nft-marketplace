import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Dialog, DialogClose, DialogContent } from "../components/ui/dialog";
import { Field, Input, Select } from "../components/ui/field";
import { Badge, Card, EmptyState, ErrorState, Skeleton } from "../components/ui/misc";
import { useSession } from "../hooks/useSession";
import { parseError } from "../services/api";
import {
  addWallet,
  deleteWallet,
  fetchWallets,
  updateWallet,
} from "../services/endpoints";
import { toast } from "../services/toast";
import type { Wallet } from "../types";

const schema = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Use 0x seguido de 40 caracteres hexadecimais."),
  network: z.enum(["Ethereum", "Polygon", "Arbitrum"]),
  label: z.string().max(30, "Use até 30 caracteres.").optional(),
});

export default function WalletsPage() {
  const { data: user } = useSession();
  const queryClient = useQueryClient();
  const key = ["wallets", user?.id];
  const [toRemove, setToRemove] = useState<Wallet | null>(null);
  // Guarda o botão que abriu o diálogo para devolver o foco ao fechar
  const lastTrigger = useRef<HTMLElement | null>(null);

  const wallets = useQuery({
    queryKey: key,
    queryFn: fetchWallets,
    enabled: !!user,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { network: "Ethereum" },
  });

  const add = useMutation({
    mutationFn: (v: z.infer<typeof schema>) => addWallet(v),
    onSuccess: () => {
      form.reset({ network: "Ethereum", address: "", label: "" });
      toast.success("Carteira adicionada.");
      refresh();
    },
    onError: (e) => {
      const err = parseError(e);
      const entries = Object.entries(err.fields);
      if (entries.length === 0) toast.error(err.message);
      for (const [field, message] of entries) {
        form.setError(field as keyof z.infer<typeof schema>, { message });
      }
    },
  });

  const makePrimary = useMutation({
    mutationFn: (id: string) => updateWallet(id, { isPrimary: true }),
    onSuccess: refresh,
    onError: (e) => toast.error(parseError(e).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteWallet(id),
    onSuccess: () => {
      setToRemove(null);
      toast.success("Carteira removida.");
      refresh();
    },
    onError: (e) => {
      setToRemove(null);
      toast.error(parseError(e).message);
    },
  });

  const errors = form.formState.errors;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Carteiras</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="wallet-list-title">
          <h2 id="wallet-list-title" className="sr-only">
            Suas carteiras
          </h2>
          {wallets.isLoading && <Skeleton className="h-32 w-full" />}
          {wallets.isError && (
            <ErrorState
              message={parseError(wallets.error).message}
              onRetry={() => wallets.refetch()}
            />
          )}
          {wallets.data && wallets.data.length === 0 && (
            <EmptyState
              title="Nenhuma carteira cadastrada"
              description="Adicione uma carteira para pagar seus pedidos."
            />
          )}
          <ul className="flex flex-col gap-3">
            {(wallets.data ?? []).map((w) => (
              <li key={w.id}>
                <Card
                  data-testid={`wallet-${w.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      {w.label}
                      {w.isPrimary && <Badge>Principal</Badge>}
                      <Badge>{w.network}</Badge>
                    </p>
                    <p className="mt-1 break-all text-xs text-muted">
                      {w.address}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!w.isPrimary && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={makePrimary.isPending}
                        onClick={() => makePrimary.mutate(w.id)}
                        aria-label={`Definir ${w.label} como principal`}
                      >
                        Tornar principal
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={(e) => {
                        lastTrigger.current = e.currentTarget;
                        setToRemove(w);
                      }}
                      aria-label={`Remover carteira ${w.label}`}
                    >
                      Remover
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <Card className="h-fit p-5">
          <h2 className="text-lg font-bold">Adicionar carteira</h2>
          <form
            className="mt-4 flex flex-col gap-4"
            noValidate
            onSubmit={form.handleSubmit((v) => add.mutate(v))}
          >
            <Field label="Endereço" error={errors.address?.message}>
              {(p) => (
                <Input
                  placeholder="0x..."
                  autoComplete="off"
                  {...p}
                  {...form.register("address")}
                />
              )}
            </Field>
            <Field label="Rede" error={errors.network?.message}>
              {(p) => (
                <Select {...p} {...form.register("network")}>
                  <option>Ethereum</option>
                  <option>Polygon</option>
                  <option>Arbitrum</option>
                </Select>
              )}
            </Field>
            <Field label="Apelido (opcional)" error={errors.label?.message}>
              {(p) => <Input {...p} {...form.register("label")} />}
            </Field>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? "Adicionando..." : "Adicionar carteira"}
            </Button>
          </form>
        </Card>
      </div>

      <Dialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <DialogContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            lastTrigger.current?.focus();
          }}
          title="Remover carteira?"
          description={
            toRemove
              ? `${toRemove.label} (${toRemove.address.slice(0, 10)}…) deixará de aparecer no pagamento.`
              : undefined
          }
        >
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => toRemove && remove.mutate(toRemove.id)}
            >
              Confirmar remoção
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
