import type { z } from "zod";
import type { ApiError } from "@/lib/api/types";

/** Messages per field, by the field's name (the same names the API uses). */
export type FieldErrors = Record<string, string[]>;

export type FormErrors = { message: string; fields: FieldErrors };

/** A failed schema check as form errors: each issue on the field it's about. */
export function schemaErrors(error: z.ZodError): FormErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const name = String(issue.path[0] ?? "");
    (fields[name] ??= []).push(issue.message);
  }
  return { message: error.issues[0]?.message ?? "Check the form.", fields };
}

/** An API error as form errors, without empty entries. */
export function apiErrors(message: string, fieldErrors: ApiError["fieldErrors"] = {}): FormErrors {
  const fields: FieldErrors = {};
  for (const [name, messages] of Object.entries(fieldErrors)) {
    if (messages?.length) fields[name] = messages;
  }
  return { message, fields };
}

/**
 * What the form shows as its own error: the general message when no field is named, or
 * the messages for fields the form doesn't show (they'd be lost otherwise). Null when
 * every error is shown on its field.
 */
export function formErrorMessage(
  errors: FormErrors | null,
  isShown: (name: string) => boolean,
): string | null {
  if (!errors) return null;
  const names = Object.keys(errors.fields);
  if (!names.length) return errors.message;
  const hidden = names.filter((n) => !isShown(n));
  if (!hidden.length) return null;
  return hidden.flatMap((n) => errors.fields[n]).join(" ") || errors.message;
}

/** The errors with one field's removed (the user is changing it). */
export function withoutField(errors: FormErrors | null, name: string): FormErrors | null {
  if (!errors?.fields[name]) return errors;
  const fields = { ...errors.fields };
  delete fields[name];
  return Object.keys(fields).length ? { ...errors, fields } : null;
}
