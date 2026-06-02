import { Badge } from "./Badge";

type StatusPillProps = {
  label: string;
  tone?: "neutral" | "info" | "success" | "warning" | "error";
  compact?: boolean;
};

const toneMap = {
  neutral: "default",
  info: "secondary",
  success: "success",
  warning: "warning",
  error: "destructive"
} as const;

export const StatusPill = ({ label, tone = "neutral", compact = false }: StatusPillProps) => (
  <Badge variant={toneMap[tone]} className={compact ? "px-2 py-0 text-[10px]" : undefined}>
    {label}
  </Badge>
);
