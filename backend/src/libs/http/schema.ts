import type { FastifySchemaCompiler } from "fastify";
import { z } from "zod";
import { hasZodFastifySchemaValidationErrors, validatorCompiler } from "fastify-type-provider-zod";
import { apiErrorSchema } from "../../schemas";
import type { ApiError } from "../../types";

/**
 * Route schemas (docs: web/README.md#api-schemas). Every route declares its request and
 * response bodies with zod schemas from @saas-core/shared: Fastify validates requests with
 * them, checks responses against them, and the OpenAPI document the UI's client is
 * generated from is built from them.
 */

/** Every route's error replies: the ApiError body (src/libs/errors.ts), for any 4xx or 5xx. */
export const errorResponses = { "4xx": apiErrorSchema, "5xx": apiErrorSchema } as const;

/** The responses of a route that answers 204 with no body (send it with `reply.code(204).send(null)`). */
export const noContent = { 204: z.null().describe("No content"), ...errorResponses } as const;

/** A route's path parameter `:id`. */
export const idParams = z.object({ id: z.string().min(1) });

/**
 * zod validation, with a missing body read as `{}`: a request without one gets each
 * required field's message, as a form left empty would.
 */
export const requestValidator: FastifySchemaCompiler<unknown> = (route) => {
  const validate = validatorCompiler(route as Parameters<typeof validatorCompiler>[0]);
  return (data) => validate(route.httpPart === "body" ? (data ?? {}) : data);
};

/**
 * A failed request validation as an ApiError: each message on the field it's about, and
 * the first message that isn't about a field (e.g. "Nothing to change.") as the error.
 */
export function validationApiError(error: unknown): ApiError | null {
  if (!hasZodFastifySchemaValidationErrors(error)) return null;
  const fieldErrors: Record<string, string[]> = {};
  let formError: string | undefined;
  for (const issue of error.validation) {
    const field = issue.instancePath.split("/").filter(Boolean)[0];
    const message = issue.message ?? "Check this field.";
    if (field) (fieldErrors[field] ??= []).push(message);
    else formError ??= message;
  }
  return {
    error: formError ?? "Check the highlighted fields.",
    ...(Object.keys(fieldErrors).length ? { fieldErrors } : {}),
  };
}
