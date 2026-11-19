"use client";

import { useState } from "react";
import { Form, FormError, SubmitButton, TextField, useForm } from "@/components/form";
import { Alert } from "@/components/ui/alert";
import { FieldGroup } from "@/components/ui/field";
import { browserApiClient } from "@/lib/api/browser-client";

export function ForgotPasswordForm({ company }: { company?: string }) {
  const form = useForm({ initialValues: { slug: company ?? "", email: "" } });
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) {
    return (
      <Alert variant="success">
        If an account exists for <span className="font-medium">{sentTo}</span>, we&apos;ve sent it a link to reset the
        password. The link expires in an hour.
      </Alert>
    );
  }

  return (
    <Form
      form={form}
      onSubmit={(values) => browserApiClient.requestPasswordReset(values)}
      onSuccess={(_, { email }) => setSentTo(email)}
    >
      <FieldGroup>
        {!company && <TextField name="slug" label="Workspace" placeholder="your-company" required />}
        <TextField name="email" label="Email" type="email" autoComplete="email" required autoFocus />
        <FormError />
        <SubmitButton pendingLabel="Sending…" className="w-full">
          Send reset link
        </SubmitButton>
      </FieldGroup>
    </Form>
  );
}
