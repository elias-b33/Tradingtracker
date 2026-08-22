import { useState } from "react";
import { Link, useRouteContext } from "@tanstack/react-router";
import { Cloud, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState, type AppUser } from "@/lib/auth/use-current-user";
import { useTerminalStore } from "@/lib/store";
import { cn } from "@/lib/utils";

function useResolvedUser(): AppUser | null {
  const { sessionUser } = useRouteContext({ from: "__root__" });
  const { user, isPending } = useCurrentUserState();
  if (!isPending) return user;
  if (!sessionUser) return null;
  return {
    id: sessionUser.id,
    displayName: null,
    primaryEmail: sessionUser.email,
    profileImageUrl: null,
    isDevFallback: false,
  };
}

export function AccountSlot() {
  const user = useResolvedUser();
  const cloudStatus = useTerminalStore((s) => s.cloudStatus);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    return (
      <Link
        to="/login"
        search={{ error: undefined }}
        title="Sync this desk across devices"
        className={cn(buttonVariants({ variant: "ghost", size: "xs" }), "shrink-0 text-accent")}
      >
        Sign in
      </Link>
    );
  }

  const label = user.displayName ?? user.primaryEmail ?? "Account";
  const initial = label.charAt(0).toUpperCase();
  const synced = cloudStatus === "synced" || cloudStatus === "saving";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative size-8 shrink-0 overflow-hidden rounded-full bg-elevated text-xs font-medium text-fg outline-none ring-offset-bg focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label="Account"
        >
          {user.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt=""
              className="size-full object-cover outline outline-1 -outline-offset-1 outline-white/10"
            />
          ) : (
            initial
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm text-fg">{label}</p>
          {user.primaryEmail && (
            <p className="truncate text-[11px] text-muted">{user.primaryEmail}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted">
          {synced ? (
            <Cloud className="size-3.5 text-accent" />
          ) : (
            <CloudOff className="size-3.5" />
          )}
          {cloudStatus === "saving"
            ? "Saving desk…"
            : cloudStatus === "error"
              ? "Sync paused"
              : cloudStatus === "loading"
                ? "Loading desk…"
                : "Desk synced"}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={() => {
            setSigningOut(true);
            void signOut().catch(() => setSigningOut(false));
          }}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AccountCard() {
  const user = useResolvedUser();
  const cloudStatus = useTerminalStore((s) => s.cloudStatus);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    return (
      <div className="rounded-lg bg-elevated p-3 shadow-border">
        <p className="text-sm font-medium">Sync across devices</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          Sign in and this desk follows you.
        </p>
        <Button asChild size="sm" className="mt-2">
          <Link to="/login" search={{ error: undefined }}>
            Sign in
          </Link>
        </Button>
      </div>
    );
  }

  const label = user.displayName ?? user.primaryEmail ?? "Account";

  return (
    <div className="rounded-lg bg-elevated p-4 shadow-border">
      <div className="flex items-center gap-3">
        {user.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            alt=""
            className="size-10 rounded-full object-cover outline outline-1 -outline-offset-1 outline-white/10"
          />
        ) : (
          <span className="grid size-10 place-items-center rounded-full bg-surface text-sm font-medium">
            {label.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Cloud className="size-3 text-accent" />
            {cloudStatus === "saving" ? "Saving…" : "Synced to this account"}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-3"
        disabled={signingOut}
        onClick={() => {
          setSigningOut(true);
          void signOut().catch(() => setSigningOut(false));
        }}
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
