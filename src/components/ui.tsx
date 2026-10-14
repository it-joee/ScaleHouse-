import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { STATUS_LABEL, type PriceFlag } from "@/lib/domain";

export function controlClass(hasError?: boolean, extra?: string) {
  return cn(
    "h-11 w-full rounded-md border bg-surface px-3 text-base text-ink outline-none placeholder:text-muted transition-colors",
    hasError
      ? "border-accent ring-1 ring-accent focus:border-accent focus:ring-2 focus:ring-accent/20"
      : "border-line focus:border-primary focus:ring-2 focus:ring-primary/20",
    extra,
  );
}

export const control =
  "h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink outline-none placeholder:text-muted transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

export function scrollToFirstError(container?: HTMLElement | null) {
  if (typeof document === "undefined") return;
  const root = container ?? document;
  const target =
    root.querySelector<HTMLElement>(
      'input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"], [aria-invalid="true"], [data-error="true"]',
    ) ?? root.querySelector<HTMLElement>('[role="alert"]');
  if (target) {
    const field = target.closest("label") ?? target;
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    if ("focus" in target && typeof target.focus === "function") {
      try {
        target.focus({ preventScroll: true });
      } catch {
        // ignore
      }
    }
  }
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  id,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm", className)} id={id}>
      <span className={cn("font-semibold", error ? "text-accent" : "text-ink")}>{label}</span>
      {children}
      {error ? (
        <p className="mt-0.5 text-xs font-semibold text-accent" role="alert">
          {error}
        </p>
      ) : hint ? (
        <span className="text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "accent" }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-fg",
        variant === "quiet" && "border border-line bg-surface text-ink",
        variant === "accent" && "bg-accent text-accent-fg",
        className,
      )}
      {...props}
    />
  );
}

export function StatusPill({ status }: { status: string }) {
  const hot = status === "hold" || status === "inspection";
  const done = status === "offloaded" || status === "exited" || status === "cleared";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold tracking-wide uppercase",
        hot && "bg-accent-soft text-accent",
        done && "bg-primary-soft text-primary",
        !hot && !done && "border border-line text-muted",
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const PRICE_COPY: Record<PriceFlag, string> = {
  above: "Above market",
  below: "Below market",
  at: "At market",
  none: "No desk price",
};

export function PricePill({ flag }: { flag: PriceFlag }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold tracking-wide uppercase",
        flag === "above" && "bg-accent-soft text-accent",
        flag === "below" && "bg-primary-soft text-primary",
        (flag === "at" || flag === "none") && "border border-line text-muted",
      )}
    >
      {PRICE_COPY[flag]}
    </span>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface">
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-display text-xl text-ink">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-3xl text-ink tabular-nums">{value}</p>
      {note ? <p className="mt-1 text-sm text-muted">{note}</p> : null}
    </div>
  );
}
