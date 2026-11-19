import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@saas-core/shared";
import type { Admin as AdminModel } from "@saas-core/shared/db";
import { emailSchema } from "./common";

// Signing in (platform admins and users), sign-up from an invitation, and passwords
// (/api/admin/auth, /api/auth, /api/settings/password).

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(200, "Use 200 characters or fewer.");

/** The token in a sign-up or password reset link. */
export const tokenSchema = z.string().min(1, "This link is incomplete.").max(200);

const slugSchema = z.string().trim().toLowerCase().min(1, "Enter your workspace.").max(100);

// --- Requests --------------------------------------------------------------------

export const adminLoginBody = z.object({
  username: z.string().trim().min(1, "Enter your username.").max(100),
  password: z.string().min(1, "Enter your password.").max(1000),
});

export const userLoginPayload = z.object({
  slug: slugSchema,
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(1000),
});

/** A sign-up or reset link's token, to look up what it's for. */
export const tokenBody = z.object({ token: tokenSchema });

export const acceptInvitationBody = z.object({ token: tokenSchema, password: newPasswordSchema });

export const passwordResetRequestBody = z.object({ slug: slugSchema, email: emailSchema });

export const passwordResetConfirmBody = z.object({
  token: tokenSchema,
  password: newPasswordSchema,
});

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(1000),
  newPassword: newPasswordSchema,
});

// --- Responses -------------------------------------------------------------------

/** A signed-in platform admin. */
export const adminSchema = z
  .object({ id: z.string(), username: z.string() })
  .meta({ id: "Admin" }) satisfies z.ZodType<Pick<AdminModel, "id" | "username">>;

/** What the sign-up page shows for an invitation link. */
export const invitationInfoSchema = z
  .object({ companyName: z.string(), companySlug: z.string(), email: z.string(), firstName: z.string() })
  .meta({ id: "InvitationInfo" });

/** Where to send the user after a sign-up or password reset. */
export const companyRedirectSchema = z.object({ companySlug: z.string() }).meta({ id: "CompanyRedirect" });
