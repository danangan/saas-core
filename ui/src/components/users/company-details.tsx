"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Form, FormError, SubmitButton, TextField, useForm } from "@/components/form";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { userApi, type UserScope } from "./user-api";

/**
 * A company's details, edited in place: its name, and its workspace (the slug in its
 * sign-in address), which is shown but can't be changed.
 */
export function CompanyDetails({ scope, name, slug }: { scope: UserScope; name: string; slug: string }) {
  const router = useRouter();
  const form = useForm({ initialValues: { name } });
  const value = form.values.name.trim();

  return (
    <Card className="gap-0 py-0">
      <Form
        form={form}
        onSubmit={(values) => userApi(scope).renameCompany(values.name)}
        onSuccess={(_, values) => {
          toast.success(`Renamed to ${values.name.trim()}.`);
          router.refresh();
        }}
      >
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <TextField name="name" label="Name" maxLength={100} required />
          <Field>
            <FieldLabel htmlFor="company-workspace">Workspace</FieldLabel>
            <Input id="company-workspace" value={slug} readOnly disabled className="font-mono" />
            <FieldDescription>Part of the sign-in address. It can&apos;t be changed.</FieldDescription>
          </Field>
          <FormError className="sm:col-span-2" />
        </div>
        <div className="flex justify-end border-t px-4 py-3">
          <SubmitButton pendingLabel="Saving…" disabled={!value || value === name}>
            Save
          </SubmitButton>
        </div>
      </Form>
    </Card>
  );
}
