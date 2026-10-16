import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

// Dialog do Radix: foco preso, Esc fecha e foco retorna ao gatilho.
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  onCloseAutoFocus,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  // Permite devolver o foco ao gatilho quando o diálogo é aberto por estado
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs" />
      <DialogPrimitive.Content
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-card p-6 shadow-xl",
          className,
        )}
      >
        <DialogPrimitive.Title className="text-lg font-bold text-fg">
          {title}
        </DialogPrimitive.Title>
        <DialogPrimitive.Description
          className={description ? "mt-1 text-sm text-muted" : "sr-only"}
        >
          {description ?? title}
        </DialogPrimitive.Description>
        <div className="mt-4">{children}</div>
        <DialogPrimitive.Close
          aria-label="Fechar"
          className="absolute right-4 top-4 cursor-pointer rounded-md px-2 text-lg text-muted hover:text-fg"
        >
          ✕
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
