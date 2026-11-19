"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@saas-core/shared";
import { Form, FormError, SubmitButton, TextField, useForm } from "@/components/form";
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
import { browserAdminApiClient } from "@/lib/api/admin-browser-client";

export function AddCompanyDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          Add company
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {/* Remounted on each open so the form starts empty. */}
        {open && <AddCompanyForm onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AddCompanyForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const form = useForm({ initialValues: { name: "" } });
  const slug = slugify(form.values.name);

  return (
    <Form
      form={form}
      onSubmit={(values) => browserAdminApiClient.createCompany(values)}
      onSuccess={(company) => {
        toast.success(`Created ${company.name} (${company.slug}).`);
        onDone();
        router.refresh();
      }}
    >
      <DialogHeader>
        <DialogTitle>Add company</DialogTitle>
        <DialogDescription>Users sign in to the company with its slug, so it must be unique.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
        <TextField
          name="name"
          label="Name"
          maxLength={100}
          required
          autoFocus
          description={
            <>
              Slug: <span className="font-mono text-foreground">{slug || "—"}</span>
            </>
          }
        />
        <FormError />
      </FieldGroup>
      <DialogFooter>
        <SubmitButton pendingLabel="Creating…" disabled={!slug}>
          Create company
        </SubmitButton>
      </DialogFooter>
    </Form>
  );
}
