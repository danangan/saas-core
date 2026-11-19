"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ApiResult } from "@/lib/api/http";

/**
 * Runs an API call in a transition, toasts the outcome, and refreshes the
 * server-rendered page so it shows the new data.
 */
export function useRunAction(loginPath = "/admin/login") {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run<T>(
    call: () => Promise<ApiResult<T>>,
    /** A message, or one built from the call's result. */
    successMessage: string | ((data: T) => string),
    onSuccess?: () => void,
  ) {
    startTransition(async () => {
      const result = await call();
      if (result.ok) {
        toast.success(typeof successMessage === "string" ? successMessage : successMessage(result.data));
        onSuccess?.();
      } else {
        toast.error(result.error);
        if (result.status === 401) router.replace(loginPath);
      }
      router.refresh();
    });
  }

  return { pending, run };
}
