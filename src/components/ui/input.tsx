import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-fg shadow-border outline-none transition-[box-shadow,border-color] duration-150 placeholder:text-subtle focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
