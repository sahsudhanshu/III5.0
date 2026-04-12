import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  changePercent?: number;
  prefix?: string;
  suffix?: string;
  isCurrency?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  description?: string;
}

export function StatCard({
  label,
  value,
  change,
  changePercent,
  isCurrency = false,
  className,
  size = "md",
  icon,
  description,
}: StatCardProps) {
  const isPositive = (change ?? changePercent ?? 0) >= 0;
  const isNeutral = change === 0 && changePercent === 0;

  const displayValue =
    typeof value === "number" && isCurrency
      ? formatCurrency(value)
      : typeof value === "number"
        ? value.toLocaleString("en-IN")
        : value;

  return (
    <div
      className={cn(
        "stat-card bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn("text-muted-foreground font-medium", size === "sm" ? "text-xs" : "text-xs")}>
            {label}
          </p>
          <p
            className={cn(
              "num font-bold mt-1 truncate",
              size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-xl"
            )}
          >
            {displayValue}
          </p>

          {(change !== undefined || changePercent !== undefined) && (
            <div
              className={cn(
                "flex items-center gap-1 mt-1.5",
                isNeutral
                  ? "text-muted-foreground"
                  : isPositive
                    ? "text-bull"
                    : "text-bear"
              )}
            >
              {isNeutral ? (
                <Minus className="w-3 h-3" />
              ) : isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span className="text-xs font-semibold num">
                {change !== undefined && isCurrency && `${change >= 0 ? "+" : ""}${formatCurrency(change)}`}
                {changePercent !== undefined && ` (${formatPercent(changePercent)})`}
              </span>
            </div>
          )}

          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>

        {icon && (
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

/** Inline P&L badge */
export function PnLBadge({ value, percent }: { value: number; percent: number }) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold num",
        positive ? "bg-bull-muted text-bull" : "bg-bear-muted text-bear"
      )}
    >
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {formatPercent(percent)}
    </span>
  );
}

/** Change display */
export function ChangeDisplay({
  value,
  percent,
  showValue = true,
  className,
}: {
  value: number;
  percent: number;
  showValue?: boolean;
  className?: string;
}) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-sm num font-medium",
        positive ? "text-bull" : "text-bear",
        className
      )}
    >
      {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {showValue && `${positive ? "+" : ""}${formatCurrency(Math.abs(value))} `}
      <span className="text-xs">({formatPercent(Math.abs(percent))})</span>
    </span>
  );
}
