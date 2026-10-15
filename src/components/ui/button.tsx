import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 border",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-ink border-primary hover:bg-accent hover:border-accent",
        outline:
          "bg-transparent text-fg border-line hover:bg-elevated",
        ghost: "bg-transparent text-muted border-transparent hover:bg-elevated",
        danger:
          "bg-transparent text-danger border-danger hover:bg-danger/10",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
