export function Logo({ className }: { className?: string }) {
  return (
    <span className={className}>
      <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
        <rect width="24" height="24" rx="5" className="fill-elevated" />
        <rect x="11" y="3" width="2" height="18" className="fill-accent" />
        <rect x="8" y="7" width="8" height="10" rx="1" className="fill-accent" />
      </svg>
      <span className="font-medium tracking-tight">Aether</span>
    </span>
  );
}
