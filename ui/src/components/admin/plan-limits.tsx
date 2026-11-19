import { PLAN_LABELS } from "@saas-core/shared";
import { UsageMeter } from "@/components/plan/usage-meter";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CompanyLimits } from "@/lib/api/types";

/** A company's plan, its limits, and its usage. */
export function PlanLimits({ limits }: { limits: CompanyLimits }) {
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{PLAN_LABELS[limits.plan]} plan</Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <UsageMeter label="Users" used={limits.usage.users} limit={limits.maxUsers} />
      </div>
    </Card>
  );
}
