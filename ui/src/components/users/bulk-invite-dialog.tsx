"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { BULK_INVITE_MAX } from "@saas-core/shared";
import type { BulkInviteResult, UserRole } from "@/lib/api/types";
import { parseInviteList } from "@/lib/invite-list";
import { Form, FormError, SubmitButton, TextareaField, useForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { RoleField } from "./role-select";
import { userApi, type UserScope } from "./user-api";

/** Invites several people at once from a pasted list, one per line. */
export function BulkInviteDialog({
  scope,
  companyName,
  disabled = false,
}: {
  scope: UserScope;
  companyName: string;
  /** The company is at (or over) its user limit. */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <UsersIcon data-icon="inline-start" />
          Invite several
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <BulkInviteForm scope={scope} companyName={companyName} onDone={() => setOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BulkInviteForm({
  scope,
  companyName,
  onDone,
}: {
  scope: UserScope;
  companyName: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const form = useForm({ initialValues: { text: "", role: "member" as UserRole } });
  const { entries, errors } = parseInviteList(form.values.text);
  const tooMany = entries.length > BULK_INVITE_MAX;
  const listErrors = [...errors, ...(tooMany ? [`Invite at most ${BULK_INVITE_MAX} at a time.`] : [])];

  function report(results: BulkInviteResult) {
    const count = (outcome: string) => results.filter((r) => r.outcome === outcome).length;
    const invited = count("invited");
    const exists = count("exists");
    const failed = count("email_failed");
    const limited = count("limit_reached");
    const parts = [`Invited ${invited} ${invited === 1 ? "person" : "people"}.`];
    if (exists) parts.push(`${exists} already in ${companyName}.`);
    if (failed) parts.push(`${failed} added, but their email failed: resend it.`);
    if (limited) parts.push(`${limited} not invited: the company's user limit was reached.`);
    (failed || limited ? toast.warning : toast.success)(parts.join(" "));
    onDone();
    router.refresh();
  }

  return (
    <Form
      form={form}
      onSubmit={({ role }) => userApi(scope).bulkInvite({ users: entries, role })}
      onSuccess={report}
    >
      <DialogHeader>
        <DialogTitle>Invite several people to {companyName}</DialogTitle>
        <DialogDescription>Each person gets an email with a link to set their password.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
        <TextareaField
          name="text"
          label="People"
          rows={6}
          placeholder={"Jane Doe, jane@example.com\nbob@example.com"}
          autoFocus
          errors={listErrors.length ? listErrors : undefined}
          description={
            <>
              One per line: <span className="font-mono">Name, email</span> or just an email.{" "}
              {entries.length > 0 && `${entries.length} ${entries.length === 1 ? "person" : "people"} to invite.`}
            </>
          }
        />
        <RoleField />
        <FormError />
      </FieldGroup>
      <DialogFooter>
        <SubmitButton pendingLabel="Sending invitations…" disabled={entries.length === 0 || listErrors.length > 0}>
          {`Invite ${entries.length || ""}`.trim()}
        </SubmitButton>
      </DialogFooter>
    </Form>
  );
}
