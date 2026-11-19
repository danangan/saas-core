"use client";

import { useRouter } from "next/navigation";
import { Form, FormError, SubmitButton, TextField, useForm } from "@/components/form";
import { FieldGroup } from "@/components/ui/field";
import { browserAdminApiClient } from "@/lib/api/admin-browser-client";

export function LoginForm() {
  const router = useRouter();
  const form = useForm({ initialValues: { username: "", password: "" } });

  return (
    <Form
      form={form}
      onSubmit={(values) => browserAdminApiClient.login(values)}
      onSuccess={() => {
        router.replace("/admin");
        router.refresh();
      }}
      onError={() => form.setValue("password", "")}
    >
      <FieldGroup>
        <TextField name="username" label="Username" autoComplete="username" required autoFocus />
        <TextField name="password" label="Password" type="password" autoComplete="current-password" required />
        <FormError />
        <SubmitButton pendingLabel="Signing in…" className="w-full">
          Sign in
        </SubmitButton>
      </FieldGroup>
    </Form>
  );
}
