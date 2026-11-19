import { z } from "zod";
import { BULK_INVITE_MAX } from "@saas-core/shared";
import { UserRole } from "@saas-core/shared/db";
import { UserAction } from "@saas-core/shared";
import { emailSchema, isoDate } from "./common";

// A company's users: adding (inviting) and editing them (/api/admin/companies/:id/users,
// /api/team/users), and a user's own profile (/api/settings/me, /api/settings/profile).

export const userRoleSchema = z.enum(UserRole).meta({ id: "UserRole" });
export const userActionSchema = z.enum(UserAction).meta({ id: "UserAction" });

const firstNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a first name.")
  .max(100, "Use 100 characters or fewer.");
const lastNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a last name.")
  .max(100, "Use 100 characters or fewer.");

// --- Requests --------------------------------------------------------------------

/** Add (invite) one user. Used by platform admins and company admins alike. */
export const newUserBody = z.object({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  email: emailSchema,
  role: userRoleSchema.default("member"),
});

/** Invite several users at once, all with the same role (the UI parses the pasted list). */
export const bulkInviteBody = z.object({
  users: z
    .array(
      z.object({
        firstName: firstNameSchema,
        lastName: z.string().trim().max(100),
        email: emailSchema,
      }),
    )
    .min(1, "Add at least one person.")
    .max(BULK_INVITE_MAX, `Invite at most ${BULK_INVITE_MAX} people at a time.`),
  role: userRoleSchema.default("member"),
});

/** One person in a bulk invite. */
export type InviteEntry = z.infer<typeof bulkInviteBody>["users"][number];

/** PATCH a user: any of their name, email, role, and whether they're active. */
export const updateUserBody = z
  .object({
    firstName: firstNameSchema.optional(),
    lastName: lastNameSchema.optional(),
    email: emailSchema.optional(),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Nothing to change.");

/** A user editing their own name (Settings). */
export const updateProfileBody = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Enter your first name.")
    .max(100, "Use 100 characters or fewer."),
  lastName: z
    .string()
    .trim()
    .min(1, "Enter your last name.")
    .max(100, "Use 100 characters or fewer."),
});

// --- Responses -------------------------------------------------------------------

export const userStatusSchema = z.enum(["invited", "active", "deactivated"]).meta({ id: "UserStatus" });

/** A user as their company's user list shows them. */
export const companyUserSchema = z
  .object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    role: userRoleSchema,
    status: userStatusSchema,
    /** Null until they first sign in. */
    lastSignInAt: isoDate.nullable(),
    /** The pending invitation of an invited user (null otherwise). Past `expiresAt`, it needs resending. */
    invitation: z.object({ sentAt: isoDate, expiresAt: isoDate }).nullable(),
    createdAt: isoDate,
  })
  .meta({ id: "CompanyUser" });

/** The result of a bulk invite, per person, in the order given. */
export const bulkInviteResultSchema = z
  .array(
    z.object({
      email: z.string(),
      /**
       * "invited", or why not: "exists" (already in the company), "email_failed" (added,
       * but resend), "limit_reached" (the company's user limit was reached first).
       */
      outcome: z.enum(["invited", "exists", "email_failed", "limit_reached"]),
    }),
  )
  .meta({ id: "BulkInviteResult" });

/** The signed-in user and their company. */
export const userSchema = z
  .object({
    user: z.object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      email: z.string(),
      role: userRoleSchema,
    }),
    company: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
    /** What the user's role allows (constants.ts ROLE_PERMISSIONS): the UI shows only those features. */
    permissions: z.array(userActionSchema),
  })
  .meta({ id: "User" });
