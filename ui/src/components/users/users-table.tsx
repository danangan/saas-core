import type { CompanyUser } from "@/lib/api/types";
import { LocalDate } from "@/components/local-date";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExpiryNote } from "./expiry-note";
import { UserActions } from "./user-actions";
import { ROLE_LABELS, type UserScope } from "./user-api";

/**
 * A company's users with their role, status (and invitation), and last sign-in.
 * `selfId`: the signed-in company admin, whose own row has no actions.
 */
export function UsersTable({
  scope,
  users,
  selfId,
}: {
  scope: UserScope;
  users: CompanyUser[];
  selfId?: string;
}) {
  return (
    <Card className="py-0">
      {users.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="font-medium">No users yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a user to send them an invitation.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead className="w-12 pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="pl-4 font-medium">
                  {user.firstName} {user.lastName}
                  {user.id === selfId && <span className="ml-1 text-muted-foreground">(you)</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "outline"}>
                    {ROLE_LABELS[user.role]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <ExpiryNote user={user} />
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.lastSignInAt ? <LocalDate iso={user.lastSignInAt} withTime /> : "Never"}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {user.id !== selfId && <UserActions scope={scope} user={user} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
