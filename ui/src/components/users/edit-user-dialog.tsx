"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CompanyUser } from "@/lib/api/types";
import { Form, FormError, SubmitButton, TextField, useForm } from "@/components/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { RoleField } from "./role-select";
import { userApi, type UserScope } from "./user-api";

type Editable = Pick<CompanyUser, "id" | "firstName" | "lastName" | "email" | "role">;

/** Edits a user's name, email and role. Only what changed is sent. */
export function EditUserDialog({
  scope,
  user,
  open,
  onOpenChange,
}: {
  scope: UserScope;
  user: Editable;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && <EditUserForm scope={scope} user={user} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function EditUserForm({
  scope,
  user,
  onDone,
}: {
  scope: UserScope;
  user: Editable;
  onDone: () => void;
}) {
  const router = useRouter();
  const form = useForm({
    initialValues: { firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
  });
  const { firstName, lastName, email, role } = form.values;
  const changes = {
    firstName: firstName.trim() !== user.firstName ? firstName : undefined,
    lastName: lastName.trim() !== user.lastName ? lastName : undefined,
    email: email.trim().toLowerCase() !== user.email ? email : undefined,
    role: role !== user.role ? role : undefined,
  };
  const changed = Object.values(changes).some((v) => v !== undefined);

  return (
    <Form
      form={form}
      onSubmit={() => userApi(scope).updateUser(user.id, changes)}
      onSuccess={(saved) => {
        toast.success(`Saved ${saved.email}.`);
        onDone();
        router.refresh();
      }}
    >
      <DialogHeader>
        <DialogTitle>
          Edit {user.firstName} {user.lastName}
        </DialogTitle>
        <DialogDescription>
          Their email is how they sign in. If you change it, tell them to use the new one.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
        <div className="grid grid-cols-2 gap-4">
          <TextField name="firstName" label="First name" maxLength={100} required />
          <TextField name="lastName" label="Last name" maxLength={100} required />
        </div>
        <TextField name="email" label="Email" type="email" maxLength={254} required />
        <RoleField />
        <FormError />
      </FieldGroup>
      <DialogFooter>
        <SubmitButton pendingLabel="Saving…" disabled={!changed}>
          Save changes
        </SubmitButton>
      </DialogFooter>
    </Form>
  );
}
