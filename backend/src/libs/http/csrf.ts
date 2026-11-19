import type { FastifyInstance } from "fastify";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF protection for cookie-authenticated requests:
 * - Only JSON bodies are accepted (Fastify's text/plain parser is removed), so a
 *   cross-site HTML form cannot submit to the API.
 * - Browser requests that change state must come from the app's own origin.
 *   Requests without an Origin header (server-to-server) are allowed.
 * Session cookies are also SameSite=Lax.
 */
export function registerCsrfProtection(app: FastifyInstance, allowedOrigin: string) {
  app.removeContentTypeParser("text/plain");
  app.addHook("onRequest", async (request, reply) => {
    if (SAFE_METHODS.has(request.method)) return;
    const origin = request.headers.origin;
    if (origin && origin !== allowedOrigin) {
      return reply.code(403).send({ error: "Cross-origin request rejected." });
    }
  });
}
