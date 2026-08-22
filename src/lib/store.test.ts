import { beforeEach, describe, expect, it } from "vitest";
import type { DeskPayload } from "@/lib/store";
import { snapshotDesk, useTerminalStore } from "@/lib/store";

const initialState = useTerminalStore.getInitialState();

function resetStore() {
  useTerminalStore.setState(initialState, true);
}

function remoteDesk(overrides: Partial<DeskPayload> = {}): DeskPayload {
  return {
    ...snapshotDesk(useTerminalStore.getState()),
    ...overrides,
  };
}

describe("terminal desk persistence", () => {
  beforeEach(resetStore);

  it("omits holdings from a snapshot unless the user enabled cloud holdings", () => {
    useTerminalStore.getState().setHolding({ symbol: "BTCUSDT", qty: 0.5, cost: 50_000 });

    expect(snapshotDesk().holdings).toBeUndefined();

    useTerminalStore.getState().setSyncHoldings(true);
    expect(snapshotDesk().holdings).toEqual([
      { symbol: "BTCUSDT", qty: 0.5, cost: 50_000 },
    ]);
  });

  it("restores cloud holdings on a fresh device whose local sync flag is false", () => {
    const holdings = [{ symbol: "ETHUSDT", qty: 2, cost: 2_400 }];

    useTerminalStore.getState().hydrateDesk(
      remoteDesk({ syncHoldings: true, holdings }),
    );

    expect(useTerminalStore.getState().syncHoldings).toBe(true);
    expect(useTerminalStore.getState().holdings).toEqual(holdings);
  });

  it("accepts an intentionally empty cloud portfolio and clears stale local holdings", () => {
    useTerminalStore.getState().setHolding({ symbol: "AAPL", qty: 3, cost: 190 });

    useTerminalStore.getState().hydrateDesk(
      remoteDesk({ syncHoldings: true, holdings: [] }),
    );

    expect(useTerminalStore.getState().holdings).toEqual([]);
  });

  it("does not erase local holdings when an older cloud payload has no holdings field", () => {
    const local = { symbol: "BTCUSDT", qty: 0.25, cost: 60_000 };
    useTerminalStore.getState().setHolding(local);

    useTerminalStore.getState().hydrateDesk(
      remoteDesk({ syncHoldings: true, holdings: undefined }),
    );

    expect(useTerminalStore.getState().holdings).toEqual([local]);
  });

  it("records a fired price alert and can rearm it", () => {
    useTerminalStore.getState().addAlert({
      symbol: "BTCUSDT",
      kind: "level",
      direction: "above",
      price: 75_000,
    });
    const alert = useTerminalStore.getState().alerts[0];

    useTerminalStore.getState().markAlertFired(alert.id, 75_100, "BTC breakout");

    expect(useTerminalStore.getState().alerts[0].triggeredAt).toEqual(expect.any(Number));
    expect(useTerminalStore.getState().alertLog[0]).toMatchObject({
      alertId: alert.id,
      symbol: "BTCUSDT",
      price: 75_100,
      text: "BTC breakout",
    });

    useTerminalStore.getState().rearmAlert(alert.id);
    expect(useTerminalStore.getState().alerts[0].triggeredAt).toBeUndefined();
  });
});
