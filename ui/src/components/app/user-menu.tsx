"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { browserApiClient } from "@/lib/api/browser-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="justify-start text-muted-foreground"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await browserApiClient.logout();
          router.replace("/login");
          router.refresh();
        })
      }
    >
      <LogOutIcon data-icon="inline-start" />
      Sign out
    </Button>
  );
}
