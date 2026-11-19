"use client";

import { useState } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import type { CompanyUser } from "@/lib/api/types";
import { useRunAction } from "@/components/admin/use-run-action";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditUserDialog } from "./edit-user-dialog";
import { userApi, type UserScope } from "./user-api";

/** A user's row menu: resend invitation, edit, change role, activate or deactivate, delete. */
export function UserActions({ scope, user }: { scope: UserScope; user: CompanyUser }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const api = userApi(scope);
  const { pending, run } = useRunAction(api.loginPath);
  const isActive = user.status !== "deactivated";
  const name = `${user.firstName} ${user.lastName}`.trim();
  const otherRole = user.role === "admin" ? "member" : "admin";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${user.email}`}
            disabled={pending}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {user.status === "invited" && (
            <DropdownMenuItem
              onSelect={() =>
                run(() => api.resendInvitation(user.id), `Invitation resent to ${user.email}.`)
              }
            >
              Resend invitation
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              run(
                () => api.updateUser(user.id, { role: otherRole }),
                otherRole === "admin"
                  ? `${user.email} is now an admin.`
                  : `${user.email} is now a member.`,
              )
            }
          >
            {otherRole === "admin" ? "Make admin" : "Make member"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              run(
                () => api.updateUser(user.id, { isActive: !isActive }),
                isActive ? `${user.email} deactivated and signed out.` : `${user.email} activated.`,
              )
            }
          >
            {isActive ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditUserDialog scope={scope} user={user} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={(next) => !pending && setDeleteOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {user.email} will lose access immediately.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(
                  () => api.deleteUser(user.id),
                  `${user.email} was deleted.`,
                  () => setDeleteOpen(false),
                )
              }
            >
              {pending ? "Deleting…" : "Delete user"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
