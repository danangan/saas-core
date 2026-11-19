"use client";

import type { UserRole } from "@/lib/api/types";
import { SelectField, useFormContext } from "@/components/form";
import { ROLE_LABELS } from "./user-api";

const OPTIONS = (Object.keys(ROLE_LABELS) as UserRole[]).map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

/** Admin or member, with what each can do. Inside a <Form> whose values hold `role`. */
export function RoleField({ name = "role" }: { name?: string }) {
  const { values } = useFormContext();
  return (
    <SelectField
      name={name}
      label="Role"
      options={OPTIONS}
      description={
        values[name] === "admin"
          ? "Can invite and manage the company's users."
          : "Can use the app, without managing the team or the company."
      }
    />
  );
}
