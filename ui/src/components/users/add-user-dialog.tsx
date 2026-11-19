"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import type { UserRole } from "@/lib/api/types";
import { Form, FormError, SubmitButton, TextField, useForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { RoleField } from "./role-select";
import { userApi, type UserScope } from "./user-api";

/** Adds (invites) one user. The role starts as admin for a company's first user. */
export function AddUserDialog({
  scope,
  companyName,
  defaultRole = "member",
  disabled = false,
}: {
  scope: UserScope;
  companyName: string;
  defaultRole?: UserRole;
  /** The company is at (or over) its user limit. */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <PlusIcon data-icon="inline-start" />
          Add user
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {open && (
          <AddUserForm
            scope={scope}
            companyName={companyName}
            defaultRole={defaultRole}
            onDone={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddUserForm({
  scope,
  companyName,
  defaultRole,
  onDone,
}: {
  scope: UserScope;
  companyName: string;
  defaultRole: UserRole;
  onDone: () => void;
}) {
  const router = useRouter();
  const form = useForm({
    initialValues: { firstName: "", lastName: "", email: "", role: defaultRole as UserRole },
  });

  return (
    <Form
      form={form}
      onSubmit={(values) => userApi(scope).createUser(values)}
      onSuccess={(user) => {
        toast.success(`Invitation sent to ${user.email}.`);
        onDone();
        router.refresh();
      }}
      onError={(result) => {
        // The user was added but the invitation email failed: they can resend it.
        if (result.status !== 502) return;
        toast.error(result.error);
        onDone();
        router.refresh();
      }}
    >
      <DialogHeader>
        <DialogTitle>Add user to {companyName}</DialogTitle>
        <DialogDescription>They will get an email with a link to set their password.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
        <div className="grid grid-cols-2 gap-4">
          <TextField name="firstName" label="First name" maxLength={100} required autoFocus />
          <TextField name="lastName" label="Last name" maxLength={100} required />
        </div>
        <TextField name="email" label="Email" type="email" maxLength={254} required />
        <RoleField />
        <FormError />
      </FieldGroup>
      <DialogFooter>
        <SubmitButton pendingLabel="Sending invitation…">Add and invite</SubmitButton>
      </DialogFooter>
    </Form>
  );
}
