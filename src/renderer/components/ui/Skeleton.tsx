import { cn } from "@renderer/lib/cn";

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-2xl bg-[var(--surface-3)]", className)} />
);
