"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import type { ApiResult } from "@/lib/api/http";
import {
  apiErrors,
  formErrorMessage,
  schemaErrors,
  withoutField,
  type FieldErrors,
  type FormErrors,
} from "./errors";

export type { FieldErrors } from "./errors";

type Errors = FormErrors | null;

export type Values = Record<string, unknown>;

export type FormState<V extends Values = Values> = {
  values: V;
  /** Sets one value, and clears that field's error (the user is fixing it). */
  setValue: <K extends keyof V & string>(name: K, value: V[K]) => void;
  setValues: (values: Partial<V>) => void;
  /** Back to the initial values (or these), with no errors. */
  reset: (values?: V) => void;
  pending: boolean;
  /** One field's messages, if it has any. */
  fieldErrors: (name: string) => string[] | undefined;
  /**
   * The message that isn't about any field shown in the form: a general failure ("Could
   * not reach the server"), or an error for a field the form doesn't render.
   */
  formError: string | null;
  /** Shows errors as if the API had returned them (e.g. from a check of your own). */
  setErrors: (message: string, fields?: FieldErrors) => void;
  clearErrors: () => void;
  /**
   * Checks the values against the schema (if any), then runs the call, with `pending`
   * set meanwhile. The API's errors land on their fields. Returns null when the check
   * failed and nothing was called.
   */
  submit: <T>(call: (values: V) => Promise<ApiResult<T>>) => Promise<ApiResult<T> | null>;
  /** Called by fields as they mount, so errors for them aren't repeated as the form's. */
  register: (name: string) => () => void;
};

/**
 * A form's values, submit state, and errors. Pair it with <Form> and the fields in
 * ./fields.tsx, which read and write it by name:
 *
 *   const form = useForm({ initialValues: { email: "" }, schema: emailBody });
 *   <Form form={form} onSubmit={(v) => api.send(v)} onSuccess={() => toast.success("Sent.")}>
 *     <TextField name="email" label="Email" type="email" required />
 *     <FormError />
 *     <SubmitButton pendingLabel="Sending…">Send</SubmitButton>
 *   </Form>
 *
 * A `schema` (usually the request body's, from @saas-core/shared) is checked before the
 * request, so the same messages show without a round trip; the backend still checks.
 */
export function useForm<V extends Values>({
  initialValues,
  schema,
}: {
  initialValues: V;
  schema?: z.ZodType;
}): FormState<V> {
  const initial = useRef(initialValues);
  const [values, setAll] = useState<V>(initialValues);
  const [pending, setPending] = useState(false);
  const [errors, setErrorState] = useState<Errors>(null);
  // Which fields are on screen; a ref count, as a name can appear twice (e.g. a radio group).
  const [registered, setRegistered] = useState<Record<string, number>>({});

  const clearField = useCallback((name: string) => {
    setErrorState((e) => withoutField(e, name));
  }, []);

  const setValue = useCallback(
    <K extends keyof V & string>(name: K, value: V[K]) => {
      setAll((v) => ({ ...v, [name]: value }));
      clearField(name);
    },
    [clearField],
  );

  const register = useCallback((name: string) => {
    setRegistered((r) => ({ ...r, [name]: (r[name] ?? 0) + 1 }));
    return () =>
      setRegistered((r) => {
        const next = { ...r, [name]: (r[name] ?? 1) - 1 };
        if (next[name] <= 0) delete next[name];
        return next;
      });
  }, []);

  const setErrors = useCallback(
    (message: string, fields: FieldErrors = {}) => setErrorState({ message, fields }),
    [],
  );

  const submit = useCallback(
    async <T>(call: (values: V) => Promise<ApiResult<T>>): Promise<ApiResult<T> | null> => {
      setErrorState(null);
      if (schema) {
        const parsed = schema.safeParse(values);
        if (!parsed.success) {
          setErrorState(schemaErrors(parsed.error));
          return null;
        }
      }
      setPending(true);
      try {
        const result = await call(values);
        if (!result.ok) setErrorState(apiErrors(result.error, result.fieldErrors));
        return result;
      } finally {
        setPending(false);
      }
    },
    [schema, values],
  );

  return useMemo(() => {
    const fieldErrors = (name: string) => {
      const messages = errors?.fields[name];
      return messages?.length ? messages : undefined;
    };
    const formError = formErrorMessage(errors, (name) => (registered[name] ?? 0) > 0);
    return {
      values,
      setValue,
      setValues: (partial: Partial<V>) => {
        setAll((v) => ({ ...v, ...partial }));
        Object.keys(partial).forEach(clearField);
      },
      reset: (next?: V) => {
        if (next) initial.current = next;
        setAll(initial.current);
        setErrorState(null);
      },
      pending,
      fieldErrors,
      formError,
      setErrors,
      clearErrors: () => setErrorState(null),
      submit,
      register,
    };
  }, [values, setValue, clearField, pending, errors, registered, setErrors, submit, register]);
}
