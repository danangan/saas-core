import type { ReactNode } from "react";
import { InfoIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { cn } from "cn";
import { limitState } from "./limits";

/** How much of a limit is used: "3 of 5", with a bar that turns yellow when full and red when over. */
export function UsageMeter({
  label,
  used,
  limit,
  format = String,
  info,
  className,
}: {
  label: string;
  used: number;
  limit: number;
  format?: (value: number) => string;
  /** What counts toward the limit, opened from an (i) next to the label. */
  info?: ReactNode;
  className?: string;
}) {
  const state = limitState(used, limit);
  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="flex items-center gap-1 font-medium">
          {label}
          {info && (
            <Popover>
              <PopoverTrigger
                aria-label={`About ${label.toLowerCase()}`}
                className="rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <InfoIcon className="size-3.5" />
              </PopoverTrigger>
              <PopoverContent align="end" collisionPadding={16} className="font-normal">
                {info}
              </PopoverContent>
            </Popover>
          )}
        </span>
        <span
          className={cn(
            "tabular-nums",
            state === "ok" && "text-muted-foreground",
            state === "full" && "font-medium text-amber-700 dark:text-amber-300",
            state === "over" && "font-medium text-destructive",
          )}
        >
          {format(used)} of {format(limit)}
          {state === "over" && " · over the limit"}
        </span>
      </div>
      <Progress
        value={percent}
        aria-label={`${label}: ${format(used)} of ${format(limit)}`}
        className={cn(
          state === "full" && "[&>[data-slot=progress-indicator]]:bg-amber-500",
          state === "over" && "[&>[data-slot=progress-indicator]]:bg-destructive",
        )}
      />
    </div>
  );
}
