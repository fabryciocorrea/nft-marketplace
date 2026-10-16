import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Variantes do DESIGN-SYSTEM.md: default (azul), dark, outline, ghost, link.
// Altura 40, raio 8, peso 500.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        dark: "bg-foreground text-background hover:bg-foreground/90",
        outline:
          "border-input bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
        ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        destructive:
          "border-destructive/30 bg-background text-destructive hover:bg-destructive/10",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        xs: "h-7 rounded-md px-2 text-xs",
        sm: "h-9 px-3",
        lg: "h-11 px-6 text-base",
        icon: "size-10",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  children,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2Icon className="animate-spin" aria-hidden="true" />}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
