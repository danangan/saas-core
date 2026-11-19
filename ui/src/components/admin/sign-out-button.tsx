"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { browserAdminApiClient } from "@/lib/api/admin-browser-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await browserAdminApiClient.logout();
          router.replace("/admin/login");
          router.refresh();
        })
      }
    >
      Sign out
    </Button>
  );
}
