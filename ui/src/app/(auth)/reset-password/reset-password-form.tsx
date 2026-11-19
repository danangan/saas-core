"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NewPasswordFields, passwordsReady } from "@/components/auth/new-password-fields";
import { Form, FormError, SubmitButton, useForm } from "@/components/form";
import { Alert } from "@/components/ui/alert";
import { FieldGroup } from "@/components/ui/field";
import { browserApiClient } from "@/lib/api/browser-client";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const form = useForm({ initialValues: { password: "", confirm: "" } });
  const tokenError = form.fieldErrors("token")?.[0];

  if (tokenError) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <Alert variant="destructive">{tokenError}</Alert>
        <Link href="/forgot-password" className="font-medium underline-offset-4 hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <Form
      form={form}
      onSubmit={({ password }) => browserApiClient.confirmPasswordReset({ token, password })}
      onSuccess={(data) => router.push(`/login/${encodeURIComponent(data.companySlug)}?reset=1`)}
    >
      <FieldGroup>
        <NewPasswordFields label="New password" autoFocus />
        <FormError />
        <SubmitButton
          pendingLabel="Saving…"
          disabled={!passwordsReady(form.values.password, form.values.confirm)}
          className="w-full"
        >
          Save new password
        </SubmitButton>
      </FieldGroup>
    </Form>
  );
}
