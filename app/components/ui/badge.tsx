import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground dark:bg-primary/80 dark:text-primary-foreground/90 hover:bg-primary/80 dark:hover:bg-primary/70",
        secondary:
          "border-transparent bg-secondary/80 text-secondary-foreground dark:bg-secondary/30 dark:text-secondary-foreground/80 hover:bg-secondary/60 dark:hover:bg-secondary/50",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground dark:bg-destructive/80 dark:text-destructive-foreground/90 hover:bg-destructive/80 dark:hover:bg-destructive/70",
        outline: "text-foreground dark:text-foreground/80 border-foreground/20 dark:border-foreground/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
