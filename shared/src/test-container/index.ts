/**
 * Containers for tests, via Testcontainers (see base.ts). Test code only: import from
 * "@saas-core/shared/test-containers", never from the package root, so the app never
 * loads Testcontainers.
 */
export { type TestContainer } from "./base";
export * from "./mailpit";
export * from "./postgres";
