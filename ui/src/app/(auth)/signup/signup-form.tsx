"use client";

import { useRouter } from "next/navigation";
import { NewPasswordFields, passwordsReady } from "@/components/auth/new-password-fields";
import { Form, FormError, SubmitButton, useForm } from "@/components/form";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { browserApiClient } from "@/lib/api/browser-client";

export function SignupForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const form = useForm({ initialValues: { password: "", confirm: "" } });

  return (
    <Form
      form={form}
      onSubmit={({ password }) => browserApiClient.acceptInvitation({ token, password })}
      onSuccess={(data) => router.push(`/login/${encodeURIComponent(data.companySlug)}?signedUp=1`)}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" value={email} readOnly disabled autoComplete="username" />
        </Field>
        <NewPasswordFields autoFocus />
        {/* A token error (expired, used) has no field here, so it shows as the form's. */}
        <FormError />
        <SubmitButton
          pendingLabel="Creating account…"
          disabled={!passwordsReady(form.values.password, form.values.confirm)}
          className="w-full"
        >
          Create account
        </SubmitButton>
      </FieldGroup>
    </Form>
  );
}
