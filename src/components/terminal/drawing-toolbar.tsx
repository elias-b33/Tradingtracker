import { useState } from "react";
import { Pencil, Trash2, Undo2, X } from "lucide-react";
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

/** Floating drawing palette for phones. */
export function PhoneDrawingButton() {
  const { drawingTool, setDrawingTool, clearDrawings, undoDrawing, count } = useTools();
  const [open, setOpen] = useState(false);
  const active = drawingTool !== "cursor";
  return (
    <div className="absolute bottom-12 left-2 z-20 flex flex-col-reverse items-center gap-1">
      <button
        type="button"
        aria-label={open ? "Close drawing tools" : "Drawing tools"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-11 items-center justify-center rounded-full border border-border bg-elevated text-fg shadow-border",
          (open || active) && "text-accent",
        )}
      >
        {open ? <X className="size-5" /> : <Pencil className="size-5" strokeWidth={1.5} />}
      </button>
      {open && (
        <div className="flex flex-col-reverse items-center gap-0.5 rounded-lg border border-border bg-elevated p-1 shadow-border">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              aria-label={tool.label}
              aria-pressed={drawingTool === tool.id}
              onClick={() => {
                setDrawingTool(tool.id);
                if (tool.id !== "cursor") setOpen(false);
              }}
              className={cn(
                "flex size-11 items-center justify-center rounded-md text-fg",
                drawingTool === tool.id && "bg-hover text-accent",
              )}
            >
              <tool.icon className="size-7" />
            </button>
          ))}
          <button
            type="button"
            aria-label="Undo last drawing"
            disabled={!count}
            onClick={undoDrawing}
            className="flex size-11 items-center justify-center rounded-md text-fg disabled:opacity-30"
          >
            <Undo2 className="size-5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Remove all drawings"
            disabled={!count}
            onClick={() => {
              clearDrawings();
              setOpen(false);
            }}
            className="flex size-11 items-center justify-center rounded-md text-fg disabled:opacity-30"
          >
            <Trash2 className="size-5" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
