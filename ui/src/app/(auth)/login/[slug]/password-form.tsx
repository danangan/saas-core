"use client";

import { useRouter } from "next/navigation";
import { Form, FormError, SubmitButton, TextField, useForm } from "@/components/form";
import { FieldGroup } from "@/components/ui/field";
import { browserApiClient } from "@/lib/api/browser-client";

export function PasswordForm({ slug }: { slug: string }) {
  const router = useRouter();
  const form = useForm({ initialValues: { email: "", password: "" } });

  return (
    <Form
      form={form}
      onSubmit={({ email, password }) => browserApiClient.login({ slug, email, password })}
      onSuccess={() => {
        router.replace("/home");
        router.refresh();
      }}
      onError={() => form.setValue("password", "")}
    >
      <FieldGroup>
        <TextField name="email" label="Email" type="email" autoComplete="username" required autoFocus />
        <TextField name="password" label="Password" type="password" autoComplete="current-password" required />
        <FormError />
        <SubmitButton pendingLabel="Signing in…" className="w-full">
          Sign in
        </SubmitButton>
      </FieldGroup>
    </Form>
  );
}
