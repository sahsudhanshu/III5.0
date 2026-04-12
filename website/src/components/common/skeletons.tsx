import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Stat card skeleton
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-xl p-4", className)}>
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-7 w-36 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

// Table row skeleton
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

// Chart skeleton
export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="relative w-full" style={{ height }}>
      <Skeleton className="w-full h-full rounded-xl" />
      <div className="absolute inset-0 flex items-end gap-2 px-4 pb-4 opacity-30">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-primary/20 rounded-t"
            style={{ height: `${20 + ((i * 17) % 60)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// News card skeleton
export function NewsCardSkeleton() {
  return (
    <div className="flex gap-3 p-3 border border-border rounded-xl">
      <Skeleton className="w-16 h-16 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

// Stock card skeleton
export function StockCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div>
          <Skeleton className="h-4 w-20 mb-1" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
      <Skeleton className="h-6 w-28 mb-2" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

// Page loading
export function PageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <ChartSkeleton height={300} />
    </div>
  );
}
