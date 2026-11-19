"use client";

import { PASSWORD_MIN_LENGTH } from "@saas-core/shared";
import { TextField, useFormContext } from "@/components/form";

/**
 * "New password" + "Confirm password", inside a <Form> whose values hold `name` and
 * `confirm`. The mismatch is checked here, as the user types.
 */
export function NewPasswordFields({
  name = "password",
  label = "Password",
  autoFocus,
}: {
  name?: string;
  label?: string;
  autoFocus?: boolean;
}) {
  const { values } = useFormContext();
  const password = String(values[name] ?? "");
  const confirm = String(values.confirm ?? "");
  const mismatch = confirm.length > 0 && confirm !== password;
  return (
    <>
      <TextField
        name={name}
        label={label}
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        required
        autoFocus={autoFocus}
        description={`At least ${PASSWORD_MIN_LENGTH} characters.`}
      />
      <TextField
        name="confirm"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        required
        errors={mismatch ? ["Passwords don't match."] : undefined}
      />
    </>
  );
}

export function passwordsReady(password: unknown, confirm: unknown): boolean {
  return typeof password === "string" && password.length >= PASSWORD_MIN_LENGTH && password === confirm;
}
