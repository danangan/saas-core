import { BoxIcon } from "lucide-react";
import { cn } from "cn";

/** The product logo: a mark and the name. Replace with your own. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-heading text-lg font-bold tracking-tight", className)}>
      <span aria-hidden className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <BoxIcon className="size-3.5" />
      </span>
      SaaS Core
    </span>
  );
}
