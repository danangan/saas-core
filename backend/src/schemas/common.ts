import { z } from "zod";

// Building blocks the areas' schemas share.

/** A date, sent as an ISO 8601 string. */
export const isoDate = z.iso.datetime();

/** An email address, trimmed and in lower case. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254, "Use 254 characters or fewer."));

/** Body of every non-2xx response. */
export const apiErrorSchema = z
  .object({
    error: z.string(),
    /** Per-field messages for 400 validation errors and field conflicts (409). */
    fieldErrors: z.record(z.string(), z.array(z.string()).optional()).optional(),
  })
  .meta({ id: "ApiError" });
