import type { ModrinthVersionOption } from "@shared/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@renderer/components/ui/Select";

type ModVersionSelectProps = {
  value?: string;
  options: ModrinthVersionOption[];
  disabled?: boolean;
  loading?: boolean;
  emptyLabel?: string;
  placeholder?: string;
  onValueChange: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
};

const formatLoader = (loader?: string) => {
  if (!loader) {
    return undefined;
  }
  return loader.charAt(0).toUpperCase() + loader.slice(1);
};

export const formatModVersionLabel = (option: ModrinthVersionOption) => {
  const primaryVersion = option.gameVersions[0];
  const loader = formatLoader(option.loaders[0]);
  return [option.versionNumber, primaryVersion, loader].filter(Boolean).join(" • ");
};

export const ModVersionSelect = ({
  value,
  options,
  disabled,
  loading,
  emptyLabel = "No compatible version",
  placeholder = "Choose version",
  onValueChange,
  onOpenChange
}: ModVersionSelectProps) => {
  const singleOption = options[0];
  const resolvedPlaceholder = loading
    ? "Loading version..."
    : options.length === 0
      ? emptyLabel
      : placeholder;

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      onOpenChange={onOpenChange}
      disabled={disabled || loading || options.length <= 1}
    >
    <SelectTrigger className="min-w-[220px]">
      <SelectValue placeholder={resolvedPlaceholder}>
        {singleOption && !value ? formatModVersionLabel(singleOption) : undefined}
      </SelectValue>
    </SelectTrigger>
    <SelectContent>
      {options.map((option) => (
        <SelectItem key={option.id} value={option.id}>
          {formatModVersionLabel(option)}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  );
};
