import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

/** Bottom sheet in the TradingView app style: #1c1c1e, grab handle, rounded top. */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-[14px] bg-[#1c1c1e] pb-[env(safe-area-inset-bottom)] text-fg outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom",
            className,
          )}
        >
          <div className="flex justify-center pt-2 pb-1">
            <span className="h-1 w-9 rounded-full bg-[#4a4a4c]" />
          </div>
          <div className="relative flex h-11 shrink-0 items-center justify-center px-4">
            <DialogPrimitive.Close className="absolute left-4 text-[16px] text-fg">Close</DialogPrimitive.Close>
            <DialogPrimitive.Title className="text-[17px] font-semibold text-strong">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function SheetRow({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 px-4 text-left text-[16px] text-fg active:bg-[#2a2a2a]",
        active && "text-strong",
      )}
    >
      {children}
    </button>
  );
}

export function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pb-2">
      <p className="px-4 pt-3 pb-1 text-[13px] font-semibold text-[#8c8c8c]">{title}</p>
      {children}
    </div>
  );
}
