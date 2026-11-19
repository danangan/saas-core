import { z } from "zod";
import { slugify } from "@saas-core/shared";
import { Plan, type Company as CompanyModel } from "@saas-core/shared/db";
import { isoDate } from "./common";
import { companyUserSchema } from "./user";

// Companies: creating and changing them (/api/admin/companies, /api/company),
// their public sign-in info (/api/auth/companies/:slug), and their activity.

export const companyNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a company name.")
  .max(100, "Use 100 characters or fewer.")
  .refine(
    (name) => slugify(name).length > 0,
    "The name must contain at least one letter or number.",
  );

export const planSchema = z.enum(Plan).meta({ id: "Plan" });

// --- Requests --------------------------------------------------------------------

export const createCompanyBody = z.object({ name: companyNameSchema });

/** A company admin renaming their own company. */
export const renameCompanyBody = z.object({ name: companyNameSchema });

/** PATCH a company (platform admins): any of its name, whether it's active, and its plan. The slug never changes. */
export const updateCompanyBody = z
  .object({
    name: companyNameSchema.optional(),
    isActive: z.boolean().optional(),
    plan: planSchema.optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Nothing to change.");

// --- Responses -------------------------------------------------------------------

/** A company's plan, its limits, and what it uses. */
export const companyLimitsSchema = z
  .object({
    plan: planSchema,
    maxUsers: z.number().int(),
    /** Users who can sign in or are invited. Can exceed the limit. */
    usage: z.object({ users: z.number().int() }),
  })
  .meta({ id: "CompanyLimits" });

export const companySummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    isActive: z.boolean(),
    plan: planSchema,
    createdAt: isoDate,
    userCount: z.number().int(),
  })
  .meta({ id: "CompanySummary" });

export const companyDetailSchema = companySummarySchema
  .omit({ userCount: true })
  .extend({ users: z.array(companyUserSchema), limits: companyLimitsSchema })
  .meta({ id: "CompanyDetail" });

/** PATCH a company: what it is now. */
export const companyStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  limits: companyLimitsSchema,
});

/** A company's public sign-in info (login step 1). */
export const companyPublicSchema = z
  .object({ name: z.string(), slug: z.string() })
  .meta({ id: "CompanyPublic" }) satisfies z.ZodType<Pick<CompanyModel, "name" | "slug">>;

/** One entry of a company's activity (audit log), newest first. */
export const auditEntrySchema = z
  .object({
    id: z.string(),
    /** e.g. "user.invited"; see AUDIT_ACTION_LABELS. */
    action: z.string(),
    actorType: z.enum(["admin", "user"]),
    actorLabel: z.string(),
    targetLabel: z.string().nullable(),
    details: z.record(z.string(), z.unknown()),
    createdAt: isoDate,
  })
  .meta({ id: "AuditEntry" });
