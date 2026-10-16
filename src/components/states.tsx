import type { ReactNode } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

// Erro com opção de tentar novamente (role=alert vem do Alert do shadcn)
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive" className="rounded-lg bg-destructive/5">
      <AlertCircleIcon aria-hidden="true" />
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button variant="outline" size="xs" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
  children,
  level = 2,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  // 1 quando o estado vazio ocupa a página inteira (a página precisa de um h1)
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className="rounded-lg border bg-secondary px-6 py-14 text-center">
      <Heading className="text-lg font-bold">{title}</Heading>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {children && <div className="mt-5 flex justify-center">{children}</div>}
    </div>
  );
}

// Título de página (h1 do design: 32/40, 700)
export function PageTitle({
  children,
  description,
}: {
  children: ReactNode;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-[2rem] leading-10 font-bold">{children}</h1>
      {description && (
        <p className="mt-1 text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
