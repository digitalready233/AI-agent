import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Sk({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-800/75", className)} />;
}

export function StatCardSkeleton() {
  return (
    <Card className="border-slate-800/50 bg-slate-900/35">
      <CardContent className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <Sk className="h-3 w-24" />
            <Sk className="h-8 w-16" />
          </div>
          <Sk className="h-12 w-12 rounded-2xl" />
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartsSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <Card key={i} className="overflow-hidden border-slate-800/50">
          <CardHeader className="border-b border-slate-800/50">
            <Sk className="h-5 w-40" />
          </CardHeader>
          <CardContent className="h-72 p-4 pt-6">
            <Sk className="h-full w-full rounded-xl" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function RecentListsSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardHeader className="border-b border-slate-800/50 pb-4">
            <Sk className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {Array.from({ length: 5 }).map((_, j) => (
              <Sk key={j} className="h-14 w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="platform-page space-y-8">
      <div className="space-y-3 border-b border-slate-800/40 pb-8">
        <Sk className="h-9 w-64" />
        <Sk className="h-4 w-96 max-w-full" />
      </div>
      <StatsGridSkeleton />
      <ChartsSkeleton />
      <RecentListsSkeleton />
    </div>
  );
}
