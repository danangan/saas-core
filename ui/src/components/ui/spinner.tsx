import type * as React from "react";
import { Loader2Icon } from "lucide-react";
import { cn } from "cn";

/** The loading indicator. Decorative unless given a label. */
export function Spinner({ className, label, ...props }: React.ComponentProps<"svg"> & { label?: string }) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}
