"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
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
import { userApi, type UserScope } from "./user-api";

/** Renames a company. Its slug (in its sign-in address) stays the same. */
export function RenameCompanyDialog({
  scope,
  name,
  slug,
}: {
  scope: UserScope;
  name: string;
  slug: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PencilIcon data-icon="inline-start" />
          Rename
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {open && <RenameForm scope={scope} name={name} slug={slug} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  scope,
  name,
  slug,
  onDone,
}: {
  scope: UserScope;
  name: string;
  slug: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const form = useForm({ initialValues: { name } });
  const value = form.values.name.trim();

  return (
    <Form
      form={form}
      onSubmit={(values) => userApi(scope).renameCompany(values.name)}
      onSuccess={(_, values) => {
        toast.success(`Renamed to ${values.name.trim()}.`);
        onDone();
        router.refresh();
      }}
    >
      <DialogHeader>
        <DialogTitle>Rename {name}</DialogTitle>
        <DialogDescription>
          The sign-in address stays the same: <span className="font-mono">{slug}</span>.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
        <TextField name="name" label="Name" maxLength={100} required autoFocus />
        <FormError />
      </FieldGroup>
      <DialogFooter>
        <SubmitButton pendingLabel="Saving…" disabled={!value || value === name}>
          Save name
        </SubmitButton>
      </DialogFooter>
    </Form>
  );
}
