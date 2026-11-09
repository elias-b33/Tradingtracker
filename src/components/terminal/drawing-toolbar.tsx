import { Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DrawingTool } from "@/lib/market/types";
import { useTerminalStore } from "@/lib/store";
import { CrosshairIcon, FibIcon, HorizontalLineIcon, TrendLineIcon } from "./tv-icons";

const TOOLS: Array<{ id: DrawingTool; label: string; icon: typeof CrosshairIcon }> = [
  { id: "cursor", label: "Cross", icon: CrosshairIcon },
  { id: "trend", label: "Trend line", icon: TrendLineIcon },
  { id: "hline", label: "Horizontal line", icon: HorizontalLineIcon },
  { id: "fib", label: "Fib retracement", icon: FibIcon },
];

function useTools() {
  const drawingTool = useTerminalStore((s) => s.drawingTool);
  const setDrawingTool = useTerminalStore((s) => s.setDrawingTool);
  const clearDrawings = useTerminalStore((s) => s.clearDrawings);
  const undoDrawing = useTerminalStore((s) => s.undoDrawing);
  const count = useTerminalStore((s) => (s.drawings[s.symbol] ?? []).length);
  return { drawingTool, setDrawingTool, clearDrawings, undoDrawing, count };
}

const railButton =
  "flex size-10 items-center justify-center rounded-[4px] text-fg hover:bg-hover disabled:opacity-30 disabled:hover:bg-transparent";

/** Vertical drawing toolbar on the chart's left edge (desktop / tablet). */
export function DrawingToolbar() {
  const { drawingTool, setDrawingTool, clearDrawings, undoDrawing, count } = useTools();
  return (
    <div className="flex w-[52px] shrink-0 flex-col items-center gap-0.5 bg-bg py-1.5">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          title={tool.label}
          aria-label={tool.label}
          aria-pressed={drawingTool === tool.id}
          onClick={() => setDrawingTool(tool.id)}
          className={cn(railButton, drawingTool === tool.id && "bg-hover text-accent")}
        >
          <tool.icon className="size-7" />
        </button>
      ))}
      <span aria-hidden className="my-1 h-px w-7 bg-border" />
      <button
        type="button"
        title="Undo last drawing (Ctrl Z)"
        aria-label="Undo last drawing"
        disabled={!count}
        onClick={undoDrawing}
        className={railButton}
      >
        <Undo2 className="size-5" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        title="Remove all drawings"
        aria-label="Remove all drawings"
        disabled={!count}
        onClick={clearDrawings}
        className={railButton}
      >
        <Trash2 className="size-5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
