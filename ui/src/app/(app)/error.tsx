"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";

/** An unexpected error while loading a page (a failed API call the page didn't expect). */
export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorState onRetry={retry} />;
}
