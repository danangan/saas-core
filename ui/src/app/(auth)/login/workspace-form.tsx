"use client";

import { useRouter } from "next/navigation";
import { Form, SubmitButton, TextField, useForm } from "@/components/form";
import { FieldGroup } from "@/components/ui/field";
import { browserApiClient } from "@/lib/api/browser-client";

export function WorkspaceForm() {
  const router = useRouter();
  const form = useForm({ initialValues: { slug: "" } });
  const slug = form.values.slug.trim();

  return (
    <Form
      form={form}
      onSubmit={async (values) => {
        const result = await browserApiClient.findCompany(values.slug.trim().toLowerCase());
        if (!result.ok && result.status === 404) {
          const message = "We couldn't find that workspace. Check the name with your admin.";
          return { ...result, error: message, fieldErrors: { slug: [message] } };
        }
        // Any other error belongs to the field too: it's the only one.
        return result.ok ? result : { ...result, fieldErrors: { slug: [result.error] } };
      }}
      onSuccess={(company) => router.push(`/login/${company.slug}`)}
    >
      <FieldGroup>
        <TextField
          name="slug"
          label="Workspace"
          placeholder="your-company"
          autoComplete="organization"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          description="It's in your invitation email, e.g. acme-corp."
        />
        <SubmitButton pendingLabel="Checking…" disabled={!slug} className="w-full">
          Continue
        </SubmitButton>
      </FieldGroup>
    </Form>
  );
}
