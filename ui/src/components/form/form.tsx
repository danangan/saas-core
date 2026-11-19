"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import { ChevronDownIcon } from "lucide-react";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ApiResult } from "@/lib/api/http";
import type { FormState, Values } from "./use-form";

const FormContext = createContext<FormState | null>(null);

/** The form these fields are in. Fields must be inside a <Form>. */
export function useFormContext(): FormState {
  const form = useContext(FormContext);
  if (!form) throw new Error("Form fields must be inside a <Form>.");
  return form;
}

/**
 * A form wired to `useForm`: on submit it checks the values, calls `onSubmit`, and puts
 * the API's errors on their fields (the first invalid one gets focus). While the call
 * runs, every input and button inside is disabled and the submit button shows its
 * pending label.
 */
export function Form<V extends Values, T>({
  form,
  onSubmit,
  onSuccess,
  onError,
  className,
  children,
  ...props
}: Omit<ComponentProps<"form">, "onSubmit" | "onError"> & {
  form: FormState<V>;
  onSubmit: (values: V) => Promise<ApiResult<T>>;
  onSuccess?: (data: T, values: V) => void | Promise<void>;
  /** After the errors are shown, e.g. to clear a password field. */
  onError?: (result: Extract<ApiResult<T>, { ok: false }>) => void;
}) {
  const ref = useRef<HTMLFormElement>(null);

  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.pending) return;
    const values = form.values;
    const result = await form.submit(onSubmit);
    if (result?.ok) {
      await onSuccess?.(result.data, values);
      return;
    }
    if (result) onError?.(result);
    // After the errors render: move to the first field that has one.
    requestAnimationFrame(() =>
      ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );
  }

  return (
    <FormContext.Provider value={form as unknown as FormState}>
      <form ref={ref} onSubmit={handle} aria-busy={form.pending || undefined} className={className} {...props}>
        {/* `contents`, so the fieldset doesn't change the layout. */}
        <fieldset disabled={form.pending} className="contents">
          {children}
        </fieldset>
      </form>
    </FormContext.Provider>
  );
}

/** What a field passes to its control, so the label, description and errors are linked. */
export type ControlProps = {
  id: string;
  name: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
};

/**
 * A labelled field with its description and errors (from the API or the schema). Use
 * TextField, TextareaField or SelectField; this is for other controls.
 */
export function FormField({
  name,
  label,
  description,
  errors: extraErrors,
  className,
  children,
}: {
  name: string;
  label: ReactNode;
  description?: ReactNode;
  /** Errors checked in the component (e.g. passwords that don't match), shown with the form's. */
  errors?: string[];
  className?: string;
  children: (control: ControlProps) => ReactNode;
}) {
  const form = useFormContext();
  const { register } = form;
  useEffect(() => register(name), [register, name]);
  const id = `${useId()}-${name}`;
  const errors = [...(form.fieldErrors(name) ?? []), ...(extraErrors ?? [])];
  const invalid = errors.length > 0;
  const describedBy = [description && `${id}-description`, invalid && `${id}-error`]
    .filter(Boolean)
    .join(" ");
  return (
    <Field data-invalid={invalid || undefined} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children({
        id,
        name,
        "aria-invalid": invalid || undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {description && <FieldDescription id={`${id}-description`}>{description}</FieldDescription>}
      {invalid && <FieldError id={`${id}-error`} errors={errors.map((message) => ({ message }))} />}
    </Field>
  );
}

type FieldProps = {
  name: string;
  label: ReactNode;
  description?: ReactNode;
  errors?: string[];
  className?: string;
  /** Called after the value is set, with the new value. */
  onValueChange?: (value: string) => void;
};

export function TextField({
  name,
  label,
  description,
  errors,
  className,
  onValueChange,
  ...input
}: FieldProps & Omit<ComponentProps<typeof Input>, "name" | "value" | "onChange" | "id">) {
  const form = useFormContext();
  return (
    <FormField name={name} label={label} description={description} errors={errors} className={className}>
      {(control) => (
        <Input
          {...input}
          {...control}
          value={String(form.values[name] ?? "")}
          onChange={(e) => {
            form.setValue(name, e.target.value);
            onValueChange?.(e.target.value);
          }}
        />
      )}
    </FormField>
  );
}

export function TextareaField({
  name,
  label,
  description,
  errors,
  className,
  onValueChange,
  ...textarea
}: FieldProps & Omit<ComponentProps<typeof Textarea>, "name" | "value" | "onChange" | "id">) {
  const form = useFormContext();
  return (
    <FormField name={name} label={label} description={description} errors={errors} className={className}>
      {(control) => (
        <Textarea
          {...textarea}
          {...control}
          value={String(form.values[name] ?? "")}
          onChange={(e) => {
            form.setValue(name, e.target.value);
            onValueChange?.(e.target.value);
          }}
        />
      )}
    </FormField>
  );
}

/** A native <select>: short lists, and the keyboard and mobile pickers come for free. */
export function SelectField({
  name,
  label,
  description,
  errors,
  className,
  options,
  onValueChange,
  ...select
}: FieldProps & {
  options: { value: string; label: string }[];
} & Omit<ComponentProps<"select">, "name" | "value" | "onChange" | "id" | "children">) {
  const form = useFormContext();
  return (
    <FormField name={name} label={label} description={description} errors={errors} className={className}>
      {(control) => (
        // The browser's own arrow sits against the border and can't be moved, so it's
        // hidden (appearance-none) and drawn at the same inset as the text.
        <div className="relative">
          <select
            {...select}
            {...control}
            value={String(form.values[name] ?? "")}
            onChange={(e) => {
              form.setValue(name, e.target.value);
              onValueChange?.(e.target.value);
            }}
            className="h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent pr-8 pl-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      )}
    </FormField>
  );
}

/** The form's general error (one not about a field shown), as an alert. */
export function FormError({ className }: { className?: string }) {
  const { formError } = useFormContext();
  return <ErrorAlert error={formError} className={className} />;
}

/**
 * The submit button: disabled while the form is submitting, with a spinner and
 * `pendingLabel` ("Saving…") meanwhile.
 */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  className,
  ...button
}: Omit<ComponentProps<typeof Button>, "type" | "asChild"> & { pendingLabel?: ReactNode }) {
  const { pending } = useFormContext();
  return (
    <Button
      type="submit"
      loading={pending}
      loadingLabel={pendingLabel}
      disabled={disabled}
      className={className}
      {...button}
    >
      {children}
    </Button>
  );
}
