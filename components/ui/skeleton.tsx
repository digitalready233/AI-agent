import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-slate-800/80 ring-1 ring-slate-800/50",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
