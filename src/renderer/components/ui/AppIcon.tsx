import type { Icon, IconProps } from "iconsax-react";
import { cn } from "@renderer/lib/cn";

type AppIconProps = Omit<IconProps, "size"> & {
  icon: Icon;
  size?: number;
};

export const AppIcon = ({
  icon: IconComponent,
  size = 18,
  variant = "Linear",
  className,
  ...props
}: AppIconProps) => (
  <IconComponent
    size={size}
    variant={variant}
    className={cn("shrink-0", className)}
    {...props}
  />
);
