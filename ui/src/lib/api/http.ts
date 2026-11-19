import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./generated/schema";
import type { ApiError } from "./types";

/** A request's outcome: the data, or a message to show (with per-field messages on a 400). */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; fieldErrors?: ApiError["fieldErrors"] };

/** A client for the API, typed by the generated OpenAPI types: paths, bodies and responses. */
export type ApiClient = Client<paths>;

export const createApiClient = (baseUrl: string): ApiClient => createClient<paths>({ baseUrl });

const UNREACHABLE = "Could not reach the server. Check your connection and try again.";
const FAILED = "Something went wrong. Please try again.";

/**
 * Runs a request made with an ApiClient and gives its ApiResult: the response's data
 * (undefined for a 204), or the error to show.
 */
export async function call<D>(
  request: Promise<{ data?: D; error?: unknown; response: Response }>,
): Promise<ApiResult<D>> {
  let result: { data?: D; error?: unknown; response: Response };
  try {
    result = await request;
  } catch {
    return { ok: false, status: 0, error: UNREACHABLE };
  }
  const { data, error, response } = result;
  if (response.ok) return { ok: true, data: data as D };
  const body = error as Partial<ApiError> | undefined;
  return {
    ok: false,
    status: response.status,
    error: typeof body?.error === "string" ? body.error : FAILED,
    fieldErrors: body?.fieldErrors,
  };
}
