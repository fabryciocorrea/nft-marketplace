import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Field, Input } from "../components/ui/field";
import { Card } from "../components/ui/misc";
import { onAuthenticated } from "../hooks/useSession";
import { parseError } from "../services/api";
import type { ParsedError } from "../services/api";
import {
  forgotPassword,
  login,
  register as registerUser,
  socialLogin,
} from "../services/endpoints";
import { toast } from "../services/toast";
import type { User } from "../types";

const loginRoute = getRouteApi("/login");

// Aceita apenas caminhos internos (evita open redirect)
export function safeRedirect(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

function applyFieldErrors<T extends FieldValues>(
  err: ParsedError,
  setError: UseFormSetError<T>,
) {
  for (const [field, message] of Object.entries(err.fields)) {
    setError(field as Path<T>, { message });
  }
}

function useAfterAuth(redirect: string | undefined) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return async (user: User) => {
    await onAuthenticated(queryClient, user);
    router.history.push(safeRedirect(redirect));
  };
}

// ------------------------------------------------------------------ login
const loginSchema = z.object({
  email: z.string().min(1, "Informe o e-mail.").email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

export function LoginPage() {
  const { redirect } = loginRoute.useSearch();
  const afterAuth = useAfterAuth(redirect);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutation({
    mutationFn: (v: z.infer<typeof loginSchema>) =>
      login(v.email, v.password),
    onSuccess: afterAuth,
  });
  const social = useMutation({
    mutationFn: () => socialLogin("google", "demo-code"),
    onSuccess: afterAuth,
  });

  const err = mutation.isError ? parseError(mutation.error) : null;
  const retry = err?.details.retryAfterSeconds as number | undefined;

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6">
        <h1 className="text-2xl font-bold">Entrar</h1>
        {redirect && redirect !== "/" && (
          <p className="mt-1 text-sm text-muted">
            Entre para continuar de onde parou.
          </p>
        )}
        <form
          className="mt-5 flex flex-col gap-4"
          noValidate
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        >
          <Field label="E-mail" error={form.formState.errors.email?.message}>
            {(p) => (
              <Input
                type="email"
                autoComplete="email"
                {...p}
                {...form.register("email")}
              />
            )}
          </Field>
          <Field label="Senha" error={form.formState.errors.password?.message}>
            {(p) => (
              <Input
                type="password"
                autoComplete="current-password"
                {...p}
                {...form.register("password")}
              />
            )}
          </Field>

          {err && (
            <p
              role="alert"
              data-testid="login-error"
              className="rounded-lg border border-danger bg-danger/10 p-3 text-sm text-danger"
            >
              {err.message}
              {retry ? ` Tente novamente em ${retry}s.` : ""}
            </p>
          )}

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Autenticando..." : "Entrar"}
          </Button>
        </form>

        <Button
          variant="outline"
          className="mt-3 w-full"
          disabled={social.isPending}
          onClick={() => social.mutate()}
        >
          Continuar com Google
        </Button>

        <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm">
          <Link to="/forgot-password" className="text-accent underline">
            Esqueci a senha
          </Link>
          <Link to="/register" className="text-accent underline">
            Criar conta
          </Link>
        </div>
        <p className="mt-4 text-xs text-secondary">
          Conta de teste: larissa@exemplo.com / Senha@123
        </p>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ cadastro
const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o seu nome."),
    email: z.string().min(1, "Informe o e-mail.").email("E-mail inválido."),
    password: z
      .string()
      .min(8, "A senha deve ter ao menos 8 caracteres.")
      .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula.")
      .regex(/[0-9]/, "Inclua ao menos um número.")
      .regex(/[^A-Za-z0-9]/, "Inclua ao menos um símbolo."),
    confirm: z.string(),
    terms: z.literal(true, { error: "Aceite os termos para continuar." }),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "As senhas não conferem.",
  });

export function RegisterPage() {
  const afterAuth = useAfterAuth("/");
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
  });
  const mutation = useMutation({
    mutationFn: (v: z.infer<typeof registerSchema>) =>
      registerUser({ name: v.name, email: v.email, password: v.password }),
    onSuccess: afterAuth,
    onError: (e) => {
      const err = parseError(e);
      applyFieldErrors(err, form.setError);
      if (Object.keys(err.fields).length === 0) toast.error(err.message);
    },
  });
  const errors = form.formState.errors;

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6">
        <h1 className="text-2xl font-bold">Criar conta</h1>
        <form
          className="mt-5 flex flex-col gap-4"
          noValidate
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        >
          <Field label="Nome" error={errors.name?.message}>
            {(p) => (
              <Input autoComplete="name" {...p} {...form.register("name")} />
            )}
          </Field>
          <Field label="E-mail" error={errors.email?.message}>
            {(p) => (
              <Input
                type="email"
                autoComplete="email"
                {...p}
                {...form.register("email")}
              />
            )}
          </Field>
          <Field
            label="Senha"
            error={errors.password?.message}
            hint="Mínimo de 8 caracteres, com maiúscula, número e símbolo."
          >
            {(p) => (
              <Input
                type="password"
                autoComplete="new-password"
                {...p}
                {...form.register("password")}
              />
            )}
          </Field>
          <Field label="Confirmar senha" error={errors.confirm?.message}>
            {(p) => (
              <Input
                type="password"
                autoComplete="new-password"
                {...p}
                {...form.register("confirm")}
              />
            )}
          </Field>
          <div>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                {...form.register("terms")}
              />
              <span>Li e aceito os termos de uso e a política de privacidade.</span>
            </label>
            {errors.terms && (
              <p role="alert" className="mt-1 text-xs text-danger">
                {errors.terms.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>
        <p className="mt-4 text-sm">
          Já tem conta?{" "}
          <Link to="/login" search={{}} className="text-accent underline">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ esqueci a senha
const forgotSchema = z.object({
  email: z.string().min(1, "Informe o e-mail.").email("E-mail inválido."),
});

export function ForgotPasswordPage() {
  const form = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
  });
  const mutation = useMutation({
    mutationFn: (v: z.infer<typeof forgotSchema>) => forgotPassword(v.email),
  });

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6">
        <h1 className="text-2xl font-bold">Recuperar senha</h1>
        <form
          className="mt-5 flex flex-col gap-4"
          noValidate
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        >
          <Field label="E-mail" error={form.formState.errors.email?.message}>
            {(p) => (
              <Input
                type="email"
                autoComplete="email"
                {...p}
                {...form.register("email")}
              />
            )}
          </Field>
          <Button type="submit" disabled={mutation.isPending}>
            Enviar instruções
          </Button>
        </form>
        {mutation.isSuccess && (
          <p role="status" className="mt-4 text-sm text-success">
            Se o e-mail estiver cadastrado, você receberá as instruções.
          </p>
        )}
        <p className="mt-4 text-sm">
          <Link to="/login" search={{}} className="text-accent underline">
            Voltar ao login
          </Link>
        </p>
      </Card>
    </div>
  );
}
