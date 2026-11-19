"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import { PLAN_LABELS, PLAN_LIMITS, PLANS, type PlanName } from "@saas-core/shared";
import { Form, FormError, SelectField, SubmitButton, TextField, useForm } from "@/components/form";
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
import type { ApiResult } from "@/lib/api/http";
import type { CompanyLimits } from "@/lib/api/types";

const PLAN_OPTIONS = PLANS.map((plan) => ({
  value: plan,
  label: `${PLAN_LABELS[plan]} (${PLAN_LIMITS[plan].maxUsers} users)`,
}));

/** "" (the plan's limit), or a whole number; null when it isn't one. */
function parseLimit(text: string): number | null | undefined {
  const value = text.trim();
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : undefined;
}

/**
 * A platform admin changing a company's plan, and overriding its limits: an empty limit
 * follows the plan. A limit below what the company uses is allowed: it keeps what it has,
 * and can't add more until it's back under.
 */
export function PlanLimitsDialog({ companyId, limits }: { companyId: string; limits: CompanyLimits }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <SlidersHorizontalIcon data-icon="inline-start" />
          Change plan or limits
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {open && <PlanLimitsForm companyId={companyId} limits={limits} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function PlanLimitsForm({
  companyId,
  limits,
  onDone,
}: {
  companyId: string;
  limits: CompanyLimits;
  onDone: () => void;
}) {
  const router = useRouter();
  const form = useForm({
    initialValues: {
      plan: limits.plan as PlanName,
      maxUsers: limits.overrides.maxUsers === null ? "" : String(limits.overrides.maxUsers),
    },
  });
  const planLimits = PLAN_LIMITS[form.values.plan];

  async function save(values: typeof form.values): Promise<ApiResult<unknown>> {
    const maxUsers = parseLimit(values.maxUsers);
    if (maxUsers === undefined) {
      return {
        ok: false,
        status: 400,
        error: "Check the highlighted fields.",
        fieldErrors: { maxUsers: ["Enter a number, or leave it empty for the plan's."] },
      };
    }
    return browserAdminApiClient.updateCompanyLimits(companyId, { plan: values.plan, maxUsers });
  }

  return (
    <Form
      form={form}
      onSubmit={save}
      onSuccess={() => {
        toast.success("Plan and limits saved.");
        onDone();
        router.refresh();
      }}
    >
      <DialogHeader>
        <DialogTitle>Plan and limits</DialogTitle>
        <DialogDescription>
          Leave a limit empty to use the plan&apos;s. A limit below what the company uses keeps what it has, but
          nothing more can be added.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
        <SelectField name="plan" label="Plan" options={PLAN_OPTIONS} />
        <TextField
          name="maxUsers"
          label="User limit"
          inputMode="numeric"
          placeholder={`${planLimits.maxUsers} (the plan's)`}
        />
        <FormError />
      </FieldGroup>
      <DialogFooter>
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      </DialogFooter>
    </Form>
  );
}
