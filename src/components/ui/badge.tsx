import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium tabular-nums",
  {
    variants: {
      variant: {
        default: "bg-elevated text-muted",
        up: "bg-up/15 text-up",
        down: "bg-down/15 text-down",
        accent: "bg-accent/15 text-accent",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
