"use client";

import { useSyncExternalStore } from "react";
import type { CompanyUser } from "@/lib/api/types";
import { UserStatusBadge } from "@/components/admin/status-badge";
import { LocalDate } from "@/components/local-date";

const subscribe = () => () => {};

/**
 * A user's status badge and, for an invited one, when the invitation was sent and when
 * it expires (or that it has). Expiry is judged in the browser, like the dates.
 */
export function ExpiryNote({ user }: { user: CompanyUser }) {
  const expiresAt = user.invitation?.expiresAt;
  const expired = useSyncExternalStore(
    subscribe,
    () => Boolean(expiresAt && new Date(expiresAt).getTime() < Date.now()),
    () => false,
  );
  return (
    <>
      <UserStatusBadge status={user.status} expired={expired} />
      {user.invitation && (
        <span className="text-xs text-muted-foreground">
          Sent <LocalDate iso={user.invitation.sentAt} />
          {" · "}
          {expired ? "Expired" : "Expires"} <LocalDate iso={user.invitation.expiresAt} />
        </span>
      )}
    </>
  );
}
