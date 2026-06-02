import {
  Box,
  Code,
  Layer,
  PlayCircle,
  Profile2User,
  Setting2
} from "iconsax-react";
import { NavLink } from "react-router-dom";
import { APP_NAME } from "@shared/constants";
import { AppIcon } from "@renderer/components/ui/AppIcon";
import { brandAssets } from "@renderer/lib/brand";
import { cn } from "@renderer/lib/cn";

const items = [
  { to: "/", label: "Play", icon: PlayCircle },
  { to: "/instances", label: "Instances", icon: Layer },
  { to: "/mods", label: "Mods", icon: Box },
  { to: "/accounts", label: "Accounts", icon: Profile2User },
  { to: "/console", label: "Console", icon: Code },
  { to: "/settings", label: "Settings", icon: Setting2 }
];

export const Sidebar = () => (
  <aside className="nova-sidebar performance-blur flex shrink-0 flex-col border-r border-r-[var(--divider-color)] px-2 py-4 backdrop-blur-xl">
    <div className="flex justify-center">
      <div className="grid h-12 w-12 place-items-center rounded-[16px] border border-[var(--panel-border)] bg-[var(--surface-2)]">
        <img src={brandAssets.transparentLogo} alt={APP_NAME} className="h-10 w-10 object-contain" />
      </div>
    </div>

    <nav className="mt-6 flex flex-1 flex-col gap-1.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "group flex flex-col items-center gap-1.5 rounded-[14px] border border-transparent px-2 py-2.5 text-center transition duration-200 hover:border-[var(--panel-border)] hover:bg-[var(--surface-3)]",
                isActive && "border-[var(--accent-border)] bg-[var(--accent-soft)] shadow-[var(--button-shadow-subtle)]"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-[12px] border border-transparent bg-transparent transition",
                    isActive && "border-[var(--accent-border)] bg-[var(--surface-2)]"
                  )}
                >
                  <AppIcon
                    icon={Icon}
                    size={17}
                    variant={isActive ? "Bulk" : "Linear"}
                    className={isActive ? "text-[var(--accent-text)]" : "text-[var(--soft-text)]"}
                  />
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium text-[var(--muted-text)]",
                    isActive && "text-[var(--accent-text)]"
                  )}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  </aside>
);
