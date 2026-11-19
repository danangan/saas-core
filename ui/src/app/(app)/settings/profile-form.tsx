"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Form, FormError, SubmitButton, TextField, useForm } from "@/components/form";
import { FieldGroup } from "@/components/ui/field";
import { browserApiClient } from "@/lib/api/browser-client";

/** The signed-in user's own name. */
export function ProfileForm(props: { firstName: string; lastName: string }) {
  const router = useRouter();
  const form = useForm({
    initialValues: { firstName: props.firstName, lastName: props.lastName },
  });
  const { firstName, lastName } = form.values;
  const changed = firstName.trim() !== props.firstName || lastName.trim() !== props.lastName;

  return (
    <Form
      form={form}
      onSubmit={(values) => browserApiClient.updateProfile(values)}
      onSuccess={(user) => {
        toast.success("Name saved.");
        form.reset({ firstName: user.user.firstName, lastName: user.user.lastName });
        router.refresh();
      }}
      className="max-w-sm"
    >
      <FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <TextField name="firstName" label="First name" maxLength={100} required />
          <TextField name="lastName" label="Last name" maxLength={100} required />
        </div>
        <FormError />
        <SubmitButton pendingLabel="Saving…" disabled={!changed} className="w-fit">
          Save name
        </SubmitButton>
      </FieldGroup>
    </Form>
  );
}
