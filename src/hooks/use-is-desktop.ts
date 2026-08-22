import { useLayoutEffect, useState } from "react";

export type LayoutMode = "phone" | "tablet" | "desktop";

function readMode(): LayoutMode {
  if (window.matchMedia("(min-width: 1024px)").matches) return "desktop";
  if (window.matchMedia("(min-width: 768px)").matches) return "tablet";
  return "phone";
}

export function useLayoutMode(): LayoutMode | null {
  const [mode, setMode] = useState<LayoutMode | null>(null);

  useLayoutEffect(() => {
    const tablet = window.matchMedia("(min-width: 768px)");
    const desktop = window.matchMedia("(min-width: 1024px)");
    const apply = () => setMode(readMode());
    apply();
    tablet.addEventListener("change", apply);
    desktop.addEventListener("change", apply);
    return () => {
      tablet.removeEventListener("change", apply);
      desktop.removeEventListener("change", apply);
    };
  }, []);

  return mode;
}

export function useIsDesktop() {
  return useLayoutMode() === "desktop";
}
