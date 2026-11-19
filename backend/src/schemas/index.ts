// The API's request and response schemas (zod), by area. Routes declare them: Fastify
// validates requests and checks responses with them, and the OpenAPI document is built
// from them (pnpm openapi). The UI's client types are generated from that document.
export * from "./auth";
export * from "./common";
export * from "./company";
export * from "./user";
