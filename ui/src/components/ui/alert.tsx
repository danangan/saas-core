import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircleIcon, CheckCircle2Icon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "cn";

/**
 * A message in the page: an error that stops the user (destructive), a warning, a
 * confirmation (success), or information. For something that just happened in the
 * background, use a toast instead.
 *
 * Errors and warnings are announced to screen readers as they appear (role="alert");
 * the others politely (role="status").
 */
const alertVariants = cva(
  "relative grid w-full grid-cols-[auto_1fr] items-start gap-x-2.5 gap-y-0.5 rounded-lg border px-3 py-2.5 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        info: "border-border bg-muted/50 text-foreground [&>svg]:text-muted-foreground",
        success:
          "border-emerald-600/30 bg-emerald-600/5 text-emerald-900 dark:text-emerald-200 [&>svg]:text-emerald-600",
        warning:
          "border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600",
        destructive:
          "border-destructive/30 bg-destructive/5 text-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const ICONS = {
  info: InfoIcon,
  success: CheckCircle2Icon,
  warning: TriangleAlertIcon,
  destructive: AlertCircleIcon,
} as const;

export type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

export function Alert({
  variant = "info",
  title,
  children,
  className,
  icon = true,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> &
  VariantProps<typeof alertVariants> & {
    title?: React.ReactNode;
    /** False hides the icon. */
    icon?: boolean;
  }) {
  const Icon = ICONS[variant ?? "info"];
  const urgent = variant === "destructive" || variant === "warning";
  return (
    <div
      data-slot="alert"
      role={urgent ? "alert" : "status"}
      className={cn(alertVariants({ variant }), !icon && "grid-cols-1", className)}
      {...props}
    >
      {icon && <Icon aria-hidden />}
      <div className="flex min-w-0 flex-col gap-0.5">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className={cn(title && "opacity-90")}>{children}</div>}
      </div>
    </div>
  );
}

/** An error message from a failed action or load. Renders nothing without one. */
export function ErrorAlert({
  error,
  title,
  className,
}: {
  error: React.ReactNode | null | undefined;
  title?: React.ReactNode;
  className?: string;
}) {
  if (!error) return null;
  return (
    <Alert variant="destructive" title={title} className={className}>
      {error}
    </Alert>
  );
}
