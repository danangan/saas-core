import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "./field";
import { Input } from "./input";
import { Label } from "./label";
import { Textarea } from "./textarea";

/**
 * The raw inputs. In a form, use the fields in `@/components/form` (TextField and
 * friends), which wire these up with labels, descriptions and errors.
 */
const meta = {
  title: "Components/Inputs",
  component: Input,
  args: { placeholder: "your-company" },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextInput: Story = {
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor="workspace">Workspace</Label>
      <Input id="workspace" {...args} />
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-3">
      <Input aria-label="Default" placeholder="Default" />
      <Input aria-label="Disabled" placeholder="Disabled" disabled />
      <Input aria-label="Invalid" defaultValue="not-an-email" aria-invalid />
      <Input aria-label="File" type="file" />
    </div>
  ),
};

export const TextArea: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor="people">People</Label>
      <Textarea id="people" rows={4} placeholder={"Jane Doe, jane@example.com\nbob@example.com"} />
    </div>
  ),
};

/** The layout primitives the form fields are built on. */
export const FieldLayout: Story = {
  render: () => (
    <FieldSet className="max-w-sm">
      <FieldLegend>Profile</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="first">First name</FieldLabel>
          <Input id="first" defaultValue="Jane" />
          <FieldDescription>As your colleagues know you.</FieldDescription>
        </Field>
        <Field data-invalid>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" defaultValue="jane@" aria-invalid />
          <FieldError>Enter a valid email address.</FieldError>
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
};
