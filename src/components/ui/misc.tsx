import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("skeleton rounded-lg", className)}
      {...props}
    />
  );
}

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-line-soft bg-card", className)}
      {...props}
    />
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-danger bg-danger/10 p-4 text-sm text-danger"
    >
      <p>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 cursor-pointer font-bold underline"
        >
          Tentar novamente
        </button>
      )}
    </div>
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
  children?: React.ReactNode;
  // 1 quando o estado vazio ocupa a página inteira (a página precisa de um h1)
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className="rounded-xl border border-line-soft bg-card px-6 py-12 text-center">
      <Heading className="text-lg font-bold text-fg">{title}</Heading>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </div>
  );
}
