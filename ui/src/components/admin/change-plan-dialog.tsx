"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import { PLAN_LABELS, PLAN_LIMITS, PLANS, type PlanName } from "@saas-core/shared";
import { Form, FormError, SelectField, SubmitButton, useForm } from "@/components/form";
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

const PLAN_OPTIONS = PLANS.map((plan) => ({
  value: plan,
  label: `${PLAN_LABELS[plan]} (${PLAN_LIMITS[plan].maxUsers} users)`,
}));

/**
 * A platform admin changing a company's plan. A plan below what the company uses is
 * allowed: it keeps what it has, and can't add more until it's back under.
 */
export function ChangePlanDialog({ companyId, plan }: { companyId: string; plan: PlanName }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <SlidersHorizontalIcon data-icon="inline-start" />
          Change plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {open && <ChangePlanForm companyId={companyId} plan={plan} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ChangePlanForm({ companyId, plan, onDone }: { companyId: string; plan: PlanName; onDone: () => void }) {
  const router = useRouter();
  const form = useForm({ initialValues: { plan } });

  return (
    <Form
      form={form}
      onSubmit={(values) => browserAdminApiClient.changeCompanyPlan(companyId, values.plan)}
      onSuccess={() => {
        toast.success("Plan saved.");
        onDone();
        router.refresh();
      }}
    >
      <DialogHeader>
        <DialogTitle>Plan</DialogTitle>
        <DialogDescription>
          A plan below what the company uses keeps what it has, but nothing more can be added.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
        <SelectField name="plan" label="Plan" options={PLAN_OPTIONS} />
        <FormError />
      </FieldGroup>
      <DialogFooter>
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      </DialogFooter>
    </Form>
  );
}
