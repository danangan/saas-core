import { Badge } from "@/components/ui/badge";
import type { UserStatus } from "@/lib/api/types";

export function CompanyStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge variant="success">Active</Badge>
  ) : (
    <Badge variant="outline">Inactive</Badge>
  );
}

const userLabels: Record<UserStatus, string> = {
  invited: "Invited",
  active: "Active",
  deactivated: "Deactivated",
};

/** A user's status; an invitation past its expiry shows as expired (resend it). */
export function UserStatusBadge({
  status,
  expired = false,
}: {
  status: UserStatus;
  expired?: boolean;
}) {
  if (status === "invited" && expired)
    return <Badge variant="warning">Invitation expired</Badge>;
  const variant = status === "active" ? "success" : "outline";
  return <Badge variant={variant}>{userLabels[status]}</Badge>;
}
