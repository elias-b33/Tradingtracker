import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getDesk, saveDesk } from "@/lib/desk";
import { snapshotDesk, useTerminalStore } from "@/lib/store";

function waitForLocalHydration(): Promise<void> {
  if (useTerminalStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useTerminalStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

export function DeskSync() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id;
  const readyFor = useRef<string | null>(null);
  const greeted = useRef(false);

  useEffect(() => {
    if (isPending) return;
    if (!userId) {
      readyFor.current = null;
      useTerminalStore.getState().setCloudStatus("guest");
      return;
    }

    let cancelled = false;
    const owner = userId;
    useTerminalStore.getState().setCloudStatus("loading");

    void (async () => {
      await waitForLocalHydration();
      if (cancelled) return;
      try {
        const remote = await getDesk();
        if (cancelled) return;
        if (remote) {
          useTerminalStore.getState().hydrateDesk(remote);
        } else {
          await saveDesk({ data: snapshotDesk() });
        }
        if (cancelled) return;
        readyFor.current = owner;
        useTerminalStore.getState().setCloudStatus("synced");
        if (!greeted.current) {
          greeted.current = true;
          toast.message("Desk synced", {
            description: "Watchlist, drawings, alerts, and notes follow this account.",
          });
        }
      } catch {
        if (!cancelled) useTerminalStore.getState().setCloudStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, isPending]);

  useEffect(() => {
    if (!userId) return;
    const owner = userId;
    let timer = 0;

    const unsub = useTerminalStore.subscribe((state, prev) => {
      if (readyFor.current !== owner) return;
      if (
        state.symbol === prev.symbol &&
        state.interval === prev.interval &&
        state.span === prev.span &&
        state.chartType === prev.chartType &&
        state.indicators === prev.indicators &&
        state.drawings === prev.drawings &&
        state.watchlist === prev.watchlist &&
        state.alerts === prev.alerts &&
        state.notes === prev.notes &&
        state.events === prev.events &&
        state.lastSeenAt === prev.lastSeenAt &&
        state.syncHoldings === prev.syncHoldings &&
        state.holdings === prev.holdings
      ) {
        return;
      }
      window.clearTimeout(timer);
      useTerminalStore.getState().setCloudStatus("saving");
      timer = window.setTimeout(() => {
        void saveDesk({ data: snapshotDesk() })
          .then(() => {
            if (readyFor.current === owner) {
              useTerminalStore.getState().setCloudStatus("synced");
            }
          })
          .catch(() => {
            if (readyFor.current === owner) {
              useTerminalStore.getState().setCloudStatus("error");
            }
          });
      }, 800);
    });

    const flush = () => {
      if (readyFor.current !== owner) return;
      window.clearTimeout(timer);
      const { lastSeenAt, stampLastSeen } = useTerminalStore.getState();
      const away = lastSeenAt != null && Date.now() - lastSeenAt > 10 * 60_000;
      if (!away && useTerminalStore.persist.hasHydrated()) stampLastSeen();
      void saveDesk({ data: snapshotDesk() }).catch(() => undefined);
    };
    window.addEventListener("pagehide", flush);

    return () => {
      unsub();
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
    };
  }, [userId]);

  return null;
}
