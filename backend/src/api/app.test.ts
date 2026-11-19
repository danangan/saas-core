import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app";
import { createContainer, type Container } from "../services/container";
import { loadConfig } from "../libs/config";

// These requests are rejected before any database query; the client connects lazily.
const config = loadConfig({
  APP_URL: "http://localhost:3000",
  DB_HOST: "127.0.0.1",
  DB_PORT: "1",
  DB_NAME: "unused",
  DB_USERNAME: "unused",
  SMTP_HOST: "127.0.0.1",
});
const ORIGIN = config.appOrigin;
let container: Container;
let app: FastifyInstance;

beforeAll(async () => {
  container = createContainer(config);
  app = await buildApp({ services: container.services, appOrigin: ORIGIN, cookieSecure: false, logger: false });
});

afterAll(async () => {
  await app.close();
  await container.close();
});

describe("backend request handling", () => {
  it("serves health", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.json()).toEqual({ ok: true });
  });

  it("requires an admin session for admin routes", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/companies" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "Sign in required." });
  });

  it("rejects state-changing requests from another origin", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      payload: { username: "a", password: "b" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects non-JSON bodies", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      headers: { origin: ORIGIN, "content-type": "text/plain" },
      payload: "username=a",
    });
    expect(res.statusCode).toBe(415);
  });

  it("returns per-field validation errors", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      headers: { origin: ORIGIN },
      payload: { username: "", password: "" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().fieldErrors).toMatchObject({
      username: ["Enter your username."],
      password: ["Enter your password."],
    });
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Not found." });
  });
});

describe("loadConfig", () => {
  it("reports missing variables", () => {
    expect(() => loadConfig({})).toThrow(/APP_URL/);
  });
});
