import { Alert } from "@/components/ui/alert";
import type { CompanyLimits } from "@/lib/api/types";
import { usersState } from "./limits";

/** Shown on the Team page when the company has as many users as its plan allows, or more. */
export function UserLimitAlert({ limits }: { limits: CompanyLimits }) {
  const state = usersState(limits);
  if (state === "ok") return null;
  const count = `${limits.usage.users} of ${limits.maxUsers} users`;
  return state === "over" ? (
    <Alert variant="destructive" title="Over the user limit">
      Your company has {count}. No one can be added or reactivated until users are deactivated or deleted, or the limit
      is raised.
    </Alert>
  ) : (
    <Alert variant="warning" title="User limit reached">
      Your company has {count}. Deactivate or delete a user to add someone, or ask about a bigger plan.
    </Alert>
  );
}
