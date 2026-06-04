import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeaderSkeleton({
  className,
  lines = 2,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div className={cn("space-y-3 border-b border-slate-800/40 pb-8", className)}>
      <Skeleton className="h-9 w-64 max-w-full" />
      {lines > 1 && <Skeleton className="h-4 w-96 max-w-full" />}
    </div>
  );
}

/** Sign-in / sign-up form placeholder */
export function AuthFormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div
      className="platform-card space-y-6 rounded-2xl border border-slate-800/60 p-6 sm:p-8"
      aria-busy="true"
      aria-label="Loading form"
    >
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
      {Array.from({ length: fields - 1 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="flex items-center gap-3 py-1">
        <Skeleton className="h-px flex-1" />
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-px flex-1" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

export function AuthPageSkeleton() {
  return (
    <div className="flex min-h-[50vh] w-full max-w-[420px] flex-col justify-center space-y-10 px-6 py-12 lg:px-12">
      <div className="space-y-3">
        <Skeleton className="mx-auto h-11 w-11 rounded-xl lg:mx-0" />
        <Skeleton className="mx-auto h-8 w-48 lg:mx-0" />
        <Skeleton className="mx-auto h-4 w-72 max-w-full lg:mx-0" />
      </div>
      <AuthFormSkeleton fields={2} />
      <Skeleton className="mx-auto h-4 w-56 lg:mx-0" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="border-slate-800/50 bg-slate-900/35">
      <CardContent className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-12 w-12 rounded-2xl" />
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
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
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="h-72 p-4 pt-6">
            <Skeleton className="h-full w-full rounded-xl" />
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
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-14 w-full rounded-xl" />
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
      <PageHeaderSkeleton />
      <StatsGridSkeleton />
      <ChartsSkeleton />
      <RecentListsSkeleton />
    </div>
  );
}

/** Default for most dashboard list routes */
export function DashboardListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="platform-page space-y-6">
      <PageHeaderSkeleton lines={1} />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-lg" />
        ))}
      </div>
      <Card className="border-slate-800/50">
        <CardContent className="space-y-2 p-4 pt-4">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardDetailSkeleton() {
  return (
    <div className="platform-page space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="border-slate-800/50 lg:col-span-2">
          <CardContent className="min-h-[320px] space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className={cn("h-12 w-full rounded-xl", i > 3 && "h-20")}
              />
            ))}
          </CardContent>
        </Card>
        <Card className="border-slate-800/50">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function MarketingPageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-16 animate-pulse">
      <Skeleton className="mx-auto h-6 w-40" />
      <Skeleton className="mx-auto h-12 w-full max-w-lg" />
      <Skeleton className="mx-auto h-4 w-full max-w-md" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
