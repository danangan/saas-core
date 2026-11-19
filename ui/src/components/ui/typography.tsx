import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/**
 * Text styles used across the app. Use these instead of styling <h1>/<p> by hand, so
 * every page has the same scale:
 *
 * - <PageHeader>: a page's title (the one <h1>), description, and actions.
 * - <Heading level={2}>: a section within a page; level 3 for a group within that.
 * - <Text>: body copy; `muted` for supporting text, `small` for captions.
 */

const headingVariants = cva("scroll-m-20 tracking-tight text-foreground", {
  variants: {
    level: {
      1: "text-2xl font-semibold",
      2: "text-lg font-semibold",
      3: "text-base font-medium",
    },
  },
  defaultVariants: { level: 2 },
});

type HeadingLevel = 1 | 2 | 3;

export function Heading({
  level = 2,
  as,
  className,
  ...props
}: React.ComponentProps<"h2"> & {
  level?: HeadingLevel;
  /** Renders another element with the level's style (e.g. an <h2> that looks like level 3). */
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
}) {
  const Tag = as ?? (`h${level}` as const);
  return <Tag data-slot="heading" className={cn(headingVariants({ level }), className)} {...props} />;
}

const textVariants = cva("", {
  variants: {
    variant: {
      default: "text-sm text-foreground",
      lead: "text-base text-muted-foreground",
      muted: "text-sm text-muted-foreground",
      small: "text-xs text-muted-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Text({
  variant,
  as: Tag = "p",
  className,
  ...props
}: React.ComponentProps<"p"> &
  VariantProps<typeof textVariants> & { as?: "p" | "span" | "div" }) {
  return <Tag data-slot="text" className={cn(textVariants({ variant }), className)} {...props} />;
}

/**
 * A page's title, with an optional description below and actions to the right. A `badge`
 * (e.g. a status) sits beside the title, outside the heading, so it isn't part of the
 * heading's name.
 */
export function PageHeader({
  title,
  hideTitle = false,
  badge,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  /** Keep the title for screen readers only, e.g. where the sidebar already names the page. */
  hideTitle?: boolean;
  badge?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  // Nothing else to show: just the title, for screen readers (no empty row in the layout).
  if (hideTitle && !badge && !description && !actions) return <Heading level={1} className="sr-only">{title}</Heading>;
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1} className={cn(hideTitle && "sr-only")}>
            {title}
          </Heading>
          {badge}
        </div>
        {description && (
          <Text variant="muted" as="div" className="mt-1">
            {description}
          </Text>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A section's heading with actions to the right (e.g. "Users" with "Add user"). */
export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        <Heading level={2}>{title}</Heading>
        {description && (
          <Text variant="muted" as="div" className="mt-1">
            {description}
          </Text>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
