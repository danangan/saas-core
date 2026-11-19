"use client";

import { toast } from "sonner";
import { NewPasswordFields, passwordsReady } from "@/components/auth/new-password-fields";
import { Form, FormError, SubmitButton, TextField, useForm } from "@/components/form";
import { FieldGroup } from "@/components/ui/field";
import { browserApiClient } from "@/lib/api/browser-client";

export function ChangePasswordForm() {
  const form = useForm({ initialValues: { currentPassword: "", newPassword: "", confirm: "" } });
  const { currentPassword, newPassword, confirm } = form.values;

  return (
    <Form
      form={form}
      onSubmit={(values) =>
        browserApiClient.changePassword({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        })
      }
      onSuccess={() => {
        toast.success("Password changed. Other devices have been signed out.");
        form.reset();
      }}
      className="max-w-sm"
    >
      <FieldGroup>
        <TextField
          name="currentPassword"
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
        />
        <NewPasswordFields name="newPassword" label="New password" />
        <FormError />
        <SubmitButton
          pendingLabel="Saving…"
          disabled={!currentPassword || !passwordsReady(newPassword, confirm)}
          className="w-fit"
        >
          Change password
        </SubmitButton>
      </FieldGroup>
    </Form>
  );
}
