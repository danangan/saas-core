import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { toast } from "sonner";
import { z } from "zod";
import { FieldGroup } from "@/components/ui/field";
import type { ApiResult } from "@/lib/api/http";
import { Form, FormError, SelectField, SubmitButton, TextareaField, TextField } from "./form";
import { useForm } from "./use-form";

/** A pretend API call: waits, then answers like the backend would. */
const fakeApi =
  <T,>(result: ApiResult<T>, ms = 800) =>
  () =>
    new Promise<ApiResult<T>>((resolve) => setTimeout(() => resolve(result), ms));

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name."),
  email: z.email("Enter a valid email address."),
  role: z.enum(["admin", "member"]),
  note: z.string().max(200, "Keep it under 200 characters."),
});

type Values = z.infer<typeof schema>;
const initialValues: Values = { firstName: "", email: "", role: "member", note: "" };

function ExampleForm({ call, withSchema = true }: { call: () => Promise<ApiResult<unknown>>; withSchema?: boolean }) {
  const form = useForm({ initialValues, schema: withSchema ? schema : undefined });
  return (
    <Form form={form} onSubmit={call} onSuccess={() => void toast.success("Invitation sent.")} className="max-w-sm">
      <FieldGroup>
        <TextField name="firstName" label="First name" required />
        <TextField name="email" label="Email" type="email" description="They sign in with it." />
        <SelectField
          name="role"
          label="Role"
          options={[
            { value: "member", label: "Member" },
            { value: "admin", label: "Admin" },
          ]}
        />
        <TextareaField name="note" label="Note" rows={3} />
        <FormError />
        <SubmitButton pendingLabel="Sending invitation…" className="w-fit">
          Add and invite
        </SubmitButton>
      </FieldGroup>
    </Form>
  );
}

const meta = {
  title: "Forms/Form",
  component: ExampleForm,
  parameters: {
    docs: {
      description: {
        component: `
\`useForm\` holds the values, submit state and errors; \`<Form>\` and its fields read them by name.

\`\`\`tsx
const form = useForm({ initialValues: { email: "" }, schema: emailBody });
<Form form={form} onSubmit={(v) => api.send(v)} onSuccess={() => toast.success("Sent.")}>
  <TextField name="email" label="Email" type="email" required />
  <FormError />
  <SubmitButton pendingLabel="Sending…">Send</SubmitButton>
</Form>
\`\`\`

- **Errors**: the API's field errors land on their fields; anything else (or an error for a
  field the form doesn't show) appears in \`FormError\`. The first invalid field gets focus.
  Typing in a field clears its error.
- **Schema**: pass the request body's zod schema from \`@saas-core/shared\` to check before
  sending. The backend still checks.
- **Loading**: while submitting, every input and button is disabled, and \`SubmitButton\`
  shows a spinner and its \`pendingLabel\`.
- **Other controls**: \`FormField\` gives any control its label, description, errors and ARIA
  wiring.
`,
      },
    },
  },
} satisfies Meta<typeof ExampleForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Submits and succeeds. Try submitting with an invalid email: the schema catches it. */
export const Success: Story = { args: { call: fakeApi({ ok: true, data: {} }) } };

/** The API rejects a field: its message shows on that field. */
export const FieldErrorFromApi: Story = {
  args: {
    withSchema: false,
    call: fakeApi({
      ok: false,
      status: 409,
      error: "Someone with this email is already in Acme Corp.",
      fieldErrors: { email: ["Someone with this email is already in Acme Corp."] },
    }),
  },
};

/** An error that isn't about a field shows at the bottom of the form. */
export const GeneralError: Story = {
  args: {
    withSchema: false,
    call: fakeApi({ ok: false, status: 0, error: "Could not reach the server. Check your connection and try again." }),
  },
};

/** Stays pending for a while, to see the loading state. */
export const SlowSubmit: Story = { args: { withSchema: false, call: fakeApi({ ok: true, data: {} }, 5000) } };
