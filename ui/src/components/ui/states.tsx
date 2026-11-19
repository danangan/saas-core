"use client";

import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { cn } from "cn";

/**
 * What a page or section shows while it loads, when it has nothing, and when it fails.
 * Route segments use LoadingState in loading.tsx and ErrorState in error.tsx.
 */

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground", className)}
    >
      <Spinner />
      {label}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 py-12 text-center", className)}>
      {icon && <div className="text-muted-foreground [&_svg]:size-8">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <Text variant="muted">{description}</Text>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "This page couldn't be loaded. Try again, or come back later.",
  onRetry,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-lg flex-col gap-3 py-8", className)}>
      <Alert variant="destructive" title={title}>
        {description}
      </Alert>
      {onRetry && (
        <Button variant="outline" className="w-fit" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
