import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 pb-6", className)}>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  icon,
  tone = "primary",
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  icon?: ReactNode;
  tone?: "primary" | "success" | "warning" | "info";
}) {
  const toneMap: Record<string, string> = {
    primary: "from-primary/15 to-primary/5 text-primary",
    success: "from-success/15 to-success/5 text-success",
    warning: "from-warning/15 to-warning/5 text-warning",
    info: "from-info/15 to-info/5 text-info",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {delta && <p className="mt-1 text-xs font-medium text-success">{delta}</p>}
        </div>
        {icon && (
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br", toneMap[tone])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export function SectionCard({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-soft", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h3 className="font-display text-base font-semibold tracking-tight">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-success/15 text-success",
    unpaid: "bg-warning/15 text-warning",
    overdue: "bg-destructive/15 text-destructive",
    active: "bg-success/15 text-success",
    inactive: "bg-muted text-muted-foreground",
    present: "bg-success/15 text-success",
    absent: "bg-destructive/15 text-destructive",
    late: "bg-warning/15 text-warning",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize", map[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const colors = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white", color, className)}>
      {initials}
    </span>
  );
}
