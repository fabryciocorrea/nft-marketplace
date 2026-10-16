import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "../components/Field";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SESSION_KEY, useSession } from "../hooks/useSession";
import { parseError } from "../services/api";
import {
  changePassword,
  updateAvatar,
  updateProfile,
} from "../services/endpoints";
import { toast } from "../services/toast";
import type { User } from "../types";

function mapErrors<T extends FieldValues>(
  e: unknown,
  setError: UseFormSetError<T>,
) {
  const err = parseError(e);
  const entries = Object.entries(err.fields);
  if (entries.length === 0) toast.error(err.message);
  for (const [field, message] of entries) {
    setError(field as Path<T>, { message });
  }
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe o seu nome."),
  newsletter: z.boolean(),
});

function ProfileForm({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name,
      newsletter: user.preferences.newsletter,
    },
  });
  const mutation = useMutation({
    mutationFn: (v: z.infer<typeof profileSchema>) =>
      updateProfile({
        name: v.name,
        preferences: { newsletter: v.newsletter },
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(SESSION_KEY, updated);
      toast.success("Perfil atualizado.");
    },
    onError: (e) => mapErrors(e, form.setError),
  });

  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold">Dados pessoais</h2>
      <form
        className="mt-4 flex flex-col gap-4"
        noValidate
        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
      >
        <Field label="E-mail">
          {(p) => <Input {...p} value={user.email} readOnly />}
        </Field>
        <Field label="Nome" error={form.formState.errors.name?.message}>
          {(p) => <Input {...p} {...form.register("name")} />}
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary"
            {...form.register("newsletter")}
          />
          Receber novidades por e-mail
        </label>
        <Button type="submit" disabled={mutation.isPending}>
          Salvar alterações
        </Button>
      </form>
    </Card>
  );
}

const avatarSchema = z.object({
  url: z.string().url("Informe um endereço https válido."),
});

function AvatarForm({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof avatarSchema>>({
    resolver: zodResolver(avatarSchema),
  });
  const mutation = useMutation({
    mutationFn: (v: z.infer<typeof avatarSchema>) => updateAvatar(v.url),
    onSuccess: (updated) => {
      queryClient.setQueryData(SESSION_KEY, updated);
      form.reset();
      toast.success("Avatar atualizado.");
    },
    onError: (e) => mapErrors(e, form.setError),
  });

  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold">Avatar</h2>
      <div className="mt-3 flex items-center gap-4">
        {user.avatar ? (
          <img
            src={user.avatar}
            alt="Seu avatar"
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-xl font-bold text-primary"
          >
            {user.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <form
          className="flex flex-1 flex-col gap-3"
          noValidate
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        >
          <Field
            label="Endereço da imagem (https)"
            error={form.formState.errors.url?.message}
          >
            {(p) => <Input {...p} {...form.register("url")} />}
          </Field>
          <Button type="submit" variant="outline" disabled={mutation.isPending}>
            Atualizar avatar
          </Button>
        </form>
      </div>
    </Card>
  );
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z
      .string()
      .min(8, "A senha deve ter ao menos 8 caracteres.")
      .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula.")
      .regex(/[0-9]/, "Inclua ao menos um número.")
      .regex(/[^A-Za-z0-9]/, "Inclua ao menos um símbolo."),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ["confirm"],
    message: "As senhas não conferem.",
  });

function PasswordForm() {
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
  });
  const mutation = useMutation({
    mutationFn: (v: z.infer<typeof passwordSchema>) =>
      changePassword({
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      }),
    onSuccess: () => {
      form.reset();
      toast.success("Senha alterada. As outras sessões foram encerradas.");
    },
    onError: (e) => mapErrors(e, form.setError),
  });
  const errors = form.formState.errors;

  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold">Alterar senha</h2>
      <form
        className="mt-4 flex flex-col gap-4"
        noValidate
        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
      >
        <Field label="Senha atual" error={errors.currentPassword?.message}>
          {(p) => (
            <Input
              type="password"
              autoComplete="current-password"
              {...p}
              {...form.register("currentPassword")}
            />
          )}
        </Field>
        <Field label="Nova senha" error={errors.newPassword?.message}>
          {(p) => (
            <Input
              type="password"
              autoComplete="new-password"
              {...p}
              {...form.register("newPassword")}
            />
          )}
        </Field>
        <Field label="Confirmar nova senha" error={errors.confirm?.message}>
          {(p) => (
            <Input
              type="password"
              autoComplete="new-password"
              {...p}
              {...form.register("confirm")}
            />
          )}
        </Field>
        <Button type="submit" disabled={mutation.isPending}>
          Alterar senha
        </Button>
      </form>
    </Card>
  );
}

export default function ProfilePage() {
  const { data: user, isLoading } = useSession();
  if (isLoading || !user) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Perfil</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <ProfileForm user={user} />
          <AvatarForm user={user} />
        </div>
        <PasswordForm />
      </div>
    </div>
  );
}
