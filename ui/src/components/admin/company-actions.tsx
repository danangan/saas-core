"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontalIcon } from "lucide-react";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { browserAdminApiClient } from "@/lib/api/admin-browser-client";
import { useRunAction } from "./use-run-action";

type Company = { id: string; name: string; slug: string; isActive: boolean };

/**
 * Activate / deactivate / delete for a company. `variant="buttons"` renders inline
 * buttons (company detail page); the default renders a row dropdown (companies table).
 */
export function CompanyActions({
  company,
  variant = "menu",
  redirectAfterDelete,
}: {
  company: Company;
  variant?: "menu" | "buttons";
  redirectAfterDelete?: string;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { pending, run } = useRunAction();
  const toggle = () =>
    run(
      () => browserAdminApiClient.setCompanyActive(company.id, { isActive: !company.isActive }),
      company.isActive ? `${company.name} deactivated. Its users have been signed out.` : `${company.name} activated.`,
    );
  const toggleLabel = company.isActive ? "Deactivate" : "Activate";

  return (
    <>
      {variant === "buttons" ? (
        <div className="flex gap-2">
          <Button variant="outline" onClick={toggle} disabled={pending}>
            {toggleLabel}
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={pending}>
            Delete
          </Button>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${company.name}`} disabled={pending}>
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={toggle}>{toggleLabel}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              Delete permanently
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <DeleteCompanyDialog
        company={company}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        redirectAfterDelete={redirectAfterDelete}
      />
    </>
  );
}

function DeleteCompanyDialog({
  company,
  open,
  onOpenChange,
  redirectAfterDelete,
}: {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectAfterDelete?: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const { pending, run } = useRunAction();
  const matches = confirm.trim() === company.slug;

  function handleOpenChange(next: boolean) {
    if (pending) return;
    if (!next) setConfirm("");
    onOpenChange(next);
  }

  function handleDelete() {
    run(
      () => browserAdminApiClient.deleteCompany(company.id),
      `${company.name} is being deleted.`,
      () => {
        onOpenChange(false);
        if (redirectAfterDelete) router.push(redirectAfterDelete);
      },
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {company.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the company with all of its users and data. It cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor={`confirm-${company.id}`}>
            Type <span className="font-mono">{company.slug}</span> to confirm
          </FieldLabel>
          <Input
            id={`confirm-${company.id}`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          {/* A plain Button, not AlertDialogAction, so the dialog stays open while deleting. */}
          <Button variant="destructive" onClick={handleDelete} disabled={!matches || pending}>
            {pending ? "Deleting…" : "Delete permanently"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
