import { cn } from "@/lib/utils";

/** Filament spool mark: flange ring, wound filament band and a strand leaving the spool. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <g fill="none" className="stroke-primary-foreground" strokeLinecap="round">
        <circle cx="15" cy="17" r="9.5" strokeWidth="2" />
        <circle cx="15" cy="17" r="6.25" strokeWidth="3" strokeDasharray="30 9.3" opacity="0.85" />
        <path d="M21 12.2 C23.5 9.5 25.5 8 27.5 7.5" strokeWidth="2" />
      </g>
      <circle cx="15" cy="17" r="2.6" className="fill-primary-foreground" />
      <circle cx="15" cy="17" r="1" className="fill-primary" />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className="block text-lg font-bold tracking-tight">
            3D<span className="text-primary">2</span>GO
          </span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Backstore
          </span>
        </span>
      )}
    </span>
  );
}
