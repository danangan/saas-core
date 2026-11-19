import type { ApiError } from "../types";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ResponseSerializationError } from "fastify-type-provider-zod";
import { validationApiError } from "./http/schema";

/**
 * Errors thrown by services. They carry a message that is safe to show to the user.
 * Each class declares the HTTP status it becomes; services never deal with HTTP
 * themselves, the error handler below does.
 */
export abstract class ServiceError extends Error {
  /** HTTP status the error handler responds with. */
  abstract readonly status: number;

  constructor(
    message: string,
    /** Input field the error is about, when there is one. */
    public readonly field?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The input is well-formed but not acceptable (e.g. a wrong confirmation). */
export class InvalidInputError extends ServiceError {
  readonly status = 400;
}

/** Credentials were wrong. */
export class AuthenticationError extends ServiceError {
  readonly status = 401;
}

/** The requested record does not exist. */
export class NotFoundError extends ServiceError {
  readonly status = 404;
}

/** The request conflicts with existing data (e.g. a duplicate slug or email). */
export class ConflictError extends ServiceError {
  readonly status = 409;
}

/** The company's plan doesn't allow it: it's at (or over) a limit (e.g. its user limit). */
export class LimitReachedError extends ServiceError {
  readonly status = 403;
}

/** Too many failed attempts; try again later. */
export class TooManyAttemptsError extends ServiceError {
  readonly status = 429;
}

/** The main change was saved but a follow-up delivery (e.g. an email) failed. */
export class DeliveryFailedError extends ServiceError {
  readonly status = 502;
}

/** Something this depends on can't do it right now (e.g. a dependency is down). */
export class UnavailableError extends ServiceError {
  readonly status = 503;
}

/** An HTTP-level error (bad request body, missing session). */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly fieldErrors?: ApiError["fieldErrors"],
  ) {
    super(message);
  }
}

/** Turns every thrown error into the `ApiError` JSON shape. */
export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  // A request that doesn't match its route's schema.
  const invalid = validationApiError(error);
  if (invalid) return reply.code(400).send(invalid);
  // A response that doesn't match its route's schema: a bug here, not the client's.
  if (error instanceof ResponseSerializationError) {
    request.log.error({ err: error, issues: error.cause }, "response doesn't match its schema");
    return reply.code(500).send({ error: "Something went wrong. Please try again." } satisfies ApiError);
  }
  if (error instanceof HttpError) {
    return reply.code(error.statusCode).send({ error: error.message, fieldErrors: error.fieldErrors } satisfies ApiError);
  }
  if (error instanceof ServiceError) {
    if (error.status >= 500) request.log.error({ err: error, cause: error.cause }, error.message);
    const body: ApiError = { error: error.message };
    if (error.field) body.fieldErrors = { [error.field]: [error.message] };
    return reply.code(error.status).send(body);
  }
  // Fastify's own client errors (bad JSON, unsupported media type, body too large).
  const status = (error as FastifyError).statusCode;
  if (status && status >= 400 && status < 500) {
    return reply.code(status).send({ error: error.message } satisfies ApiError);
  }
  request.log.error(error);
  return reply.code(500).send({ error: "Something went wrong. Please try again." } satisfies ApiError);
}
